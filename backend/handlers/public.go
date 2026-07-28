package handlers

import (
	"database/sql"
	"net/http"

	"github.com/go-chi/chi/v5"
	appdb "github.com/nojusmorkunas/munus/db"
)

type publicItemView struct {
	ID                    int64  `json:"id"`
	Name                  string `json:"name"`
	Description           string `json:"description"`
	URL                   string `json:"url"`
	Price                 string `json:"price"`
	Currency              string `json:"currency"`
	ImageURL              string `json:"imageUrl"`
	Priority              int    `json:"priority"`
	Claimed               bool   `json:"claimed"`
	AvailabilityStatus    string `json:"availabilityStatus"`
	AvailabilityCheckedAt string `json:"availabilityCheckedAt"`
}

type publicUser struct {
	DisplayName string `json:"displayName"`
	AvatarURL   string `json:"avatarUrl"`
	Birthday    string `json:"birthday"`
}

func GetPublicList(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		token := chi.URLParam(r, "token")
		user, err := appdb.GetUserByPublicToken(db, token)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		items, err := appdb.GetItemsByUserID(db, user.ID, false)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		views := make([]publicItemView, len(items))
		for i, item := range items {
			views[i] = publicItemView{
				ID:                    item.ID,
				Name:                  item.Name,
				Description:           item.Description,
				URL:                   item.URL,
				Price:                 item.Price,
				Currency:              item.Currency,
				ImageURL:              item.ImageURL,
				Priority:              item.Priority,
				Claimed:               item.ClaimedBy != nil,
				AvailabilityStatus:    item.AvailabilityStatus,
				AvailabilityCheckedAt: item.AvailabilityCheckedAt,
			}
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"user":  publicUser{DisplayName: user.DisplayName, AvatarURL: user.AvatarURL, Birthday: user.Birthday},
			"items": views,
		})
	}
}
