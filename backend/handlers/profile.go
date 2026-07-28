package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strings"

	appdb "github.com/nojusmorkunas/munus/db"
	"golang.org/x/crypto/bcrypt"
)

func UpdateProfile(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var body struct {
			Username    string `json:"username"`
			DisplayName string `json:"displayName"`
			Birthday    string `json:"birthday"`
			Currency    string `json:"currency"`
			Locale      string `json:"locale"`
			AvatarURL   string `json:"avatarUrl"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.Username) == "" || strings.TrimSpace(body.DisplayName) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "username and displayName are required"})
			return
		}
		if body.Birthday != "" {
			if len(body.Birthday) != 10 || body.Birthday[4] != '-' || body.Birthday[7] != '-' {
				writeJSON(w, http.StatusBadRequest, map[string]string{"error": "birthday must be YYYY-MM-DD"})
				return
			}
		}
		updated, err := appdb.UpdateUserProfile(db, user.ID, body.Username, body.DisplayName, body.Birthday, body.Currency, body.Locale, body.AvatarURL)
		if err != nil {
			if strings.Contains(err.Error(), "UNIQUE") {
				writeJSON(w, http.StatusConflict, map[string]string{"error": "username already taken"})
				return
			}
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"user": updated})
	}
}

func UpdateProfilePassword(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var body struct {
			CurrentPassword string `json:"currentPassword"`
			NewPassword     string `json:"newPassword"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.NewPassword) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "newPassword is required"})
			return
		}
		hash, err := appdb.GetUserPasswordHash(db, user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.CurrentPassword)) != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "current password is incorrect"})
			return
		}
		if err := appdb.UpdateUserPassword(db, user.ID, body.NewPassword); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
