package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	appdb "github.com/nojusmorkunas/munus/db"
	"github.com/nojusmorkunas/munus/models"
	"golang.org/x/crypto/bcrypt"
)

type contextKey string

const userContextKey contextKey = "user"

// isSecureRequest returns true when the browser connection is HTTPS.
// Behind a reverse proxy (Cloudflare, nginx, etc.) r.TLS is always nil because
// the proxy terminates TLS and forwards plain HTTP, so we also check the
// de-facto X-Forwarded-Proto header that every major proxy sets.
func isSecureRequest(r *http.Request) bool {
	if r.TLS != nil {
		return true
	}
	return strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func UserFromContext(ctx context.Context) *models.User {
	u, _ := ctx.Value(userContextKey).(*models.User)
	return u
}

func RequireAuth(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Sessions are stored server-side. The cookie only contains the random id.
			cookie, err := r.Cookie("session")
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
			session, err := appdb.GetSession(db, cookie.Value)
			if err != nil || time.Now().After(session.ExpiresAt) {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
			user, err := appdb.GetUserByID(db, session.UserID)
			if err != nil {
				writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
				return
			}
			ctx := context.WithValue(r.Context(), userContextKey, user)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func RequireAdmin(db *sql.DB) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return RequireAuth(db)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			user := UserFromContext(r.Context())
			if user == nil || !user.IsAdmin {
				writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
				return
			}
			next.ServeHTTP(w, r)
		}))
	}
}

func Login(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Username string `json:"username"`
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		user, hash, err := appdb.GetUserByUsername(db, body.Username)
		if err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)); err != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "invalid credentials"})
			return
		}
		sessionID := uuid.NewString()
		// One month is a decent default for a small private app.
		expiresAt := time.Now().Add(30 * 24 * time.Hour)
		if err := appdb.CreateSession(db, sessionID, user.ID, expiresAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "session",
			Value:    sessionID,
			HttpOnly: true,
			Secure:   isSecureRequest(r),
			SameSite: http.SameSiteLaxMode,
			Path:     "/",
			MaxAge:   2592000,
		})
		writeJSON(w, http.StatusOK, map[string]interface{}{"user": user})
	}
}

func Logout(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session")
		if err == nil {
			appdb.DeleteSession(db, cookie.Value)
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "session",
			Value:    "",
			HttpOnly: true,
			Secure:   isSecureRequest(r),
			SameSite: http.SameSiteLaxMode,
			Path:     "/",
			MaxAge:   0,
		})
		w.WriteHeader(http.StatusNoContent)
	}
}

func Me(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		writeJSON(w, http.StatusOK, map[string]interface{}{"user": user})
	}
}

func ValidateSignupToken(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token, err := appdb.GetSignupToken(db, chi.URLParam(r, "token"))
		if err != nil || token.Used || time.Now().After(token.ExpiresAt) {
			writeJSON(w, http.StatusGone, map[string]string{"error": "invalid or expired link"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func Signup(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		// Signup links are one-time invites created by an admin.
		token, err := appdb.GetSignupToken(db, chi.URLParam(r, "token"))
		if err != nil || token.Used || time.Now().After(token.ExpiresAt) {
			writeJSON(w, http.StatusGone, map[string]string{"error": "invalid or expired link"})
			return
		}
		var body struct {
			Username    string `json:"username"`
			DisplayName string `json:"displayName"`
			Password    string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.Username) == "" || strings.TrimSpace(body.Password) == "" || strings.TrimSpace(body.DisplayName) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username, displayName and password are required"})
			return
		}
		user, err := appdb.CreateUser(db, body.Username, body.Password, body.DisplayName, "", false)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "username already taken"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if err := appdb.UseSignupToken(db, token.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		sessionID := uuid.NewString()
		expiresAt := time.Now().Add(30 * 24 * time.Hour)
		if err := appdb.CreateSession(db, sessionID, user.ID, expiresAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		http.SetCookie(w, &http.Cookie{
			Name:     "session",
			Value:    sessionID,
			HttpOnly: true,
			Secure:   isSecureRequest(r),
			SameSite: http.SameSiteLaxMode,
			Path:     "/",
			MaxAge:   2592000,
		})
		writeJSON(w, http.StatusCreated, map[string]interface{}{"user": user})
	}
}

func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
