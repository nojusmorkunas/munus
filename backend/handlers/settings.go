package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"

	appdb "github.com/nojusmorkunas/munus/db"
)

func GetSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		settings, err := appdb.GetAllSettings(db)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"currency": settings["currency"],
			"locale":   settings["locale"],
		})
	}
}

func UpdateSettings(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			Currency string `json:"currency"`
			Locale   string `json:"locale"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if body.Currency != "" {
			if err := appdb.SetSetting(db, "currency", body.Currency); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
				return
			}
		}
		if body.Locale != "" {
			if err := appdb.SetSetting(db, "locale", body.Locale); err != nil {
				writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
				return
			}
		}
		w.WriteHeader(http.StatusNoContent)
	}
}
