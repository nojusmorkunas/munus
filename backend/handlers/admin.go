package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	appdb "github.com/nojusmorkunas/munus/db"
)

func AdminCreateSignupLink(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		tokenID := uuid.NewString()
		expiresAt := time.Now().Add(7 * 24 * time.Hour)
		if err := appdb.CreateSignupToken(db, tokenID, expiresAt); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusCreated, map[string]string{"token": tokenID})
	}
}

func AdminCreateUser(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Username    string `json:"username"`
			Password    string `json:"password"`
			DisplayName string `json:"displayName"`
			Birthday    string `json:"birthday"`
			IsAdmin     bool   `json:"isAdmin"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.Username) == "" || strings.TrimSpace(body.Password) == "" || strings.TrimSpace(body.DisplayName) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username, password, and displayName are required"})
			return
		}
		if body.Birthday != "" {
			if len(body.Birthday) != 10 || body.Birthday[4] != '-' || body.Birthday[7] != '-' {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "birthday must be YYYY-MM-DD"})
				return
			}
		}
		user, err := appdb.CreateUser(db, body.Username, body.Password, body.DisplayName, body.Birthday, body.IsAdmin)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "username already taken"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusCreated, user)
	}
}

func AdminDeleteUser(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionUser := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		if id == sessionUser.ID {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "cannot delete self"})
			return
		}
		if err := appdb.DeleteUser(db, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func AdminUpdatePassword(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		var body struct {
			Password string `json:"password"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.Password) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "password is required"})
			return
		}
		if err := appdb.UpdateUserPassword(db, id, body.Password); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
