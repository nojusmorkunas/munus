package handlers

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	appdb "github.com/nojusmorkunas/munus/db"
	"github.com/nojusmorkunas/munus/models"
)

func itemToView(item models.Item, sessionUserID int64) models.ItemView {
	// Gift claims are sensitive: the owner should not see who claimed their item.
	claimedByMe := item.ClaimedBy != nil && *item.ClaimedBy == sessionUserID
	isOwner := sessionUserID == item.UserID
	var claimNote, claimedByName string
	var isPurchased bool
	if claimedByMe {
		claimNote = item.ClaimNote
		isPurchased = item.IsPurchased
	} else if item.ClaimedBy != nil && !isOwner {
		// Show the claimer's name to other viewers but never to the gift-list owner.
		claimedByName = item.ClaimedByName
	}
	return models.ItemView{
		ID:                    item.ID,
		UserID:                item.UserID,
		Name:                  item.Name,
		Description:           item.Description,
		URL:                   item.URL,
		Price:                 item.Price,
		Currency:              item.Currency,
		ImageURL:              item.ImageURL,
		Priority:              item.Priority,
		ClaimNote:             claimNote,
		IsPurchased:           isPurchased,
		IsReceived:            item.IsReceived,
		SortOrder:             item.SortOrder,
		Claimed:               item.ClaimedBy != nil,
		ClaimedByMe:           claimedByMe,
		ClaimedByName:         claimedByName,
		CreatedAt:             item.CreatedAt,
		AvailabilityStatus:    item.AvailabilityStatus,
		AvailabilityCheckedAt: item.AvailabilityCheckedAt,
	}
}

func GetMyItems(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		// The owner can see archived items, but not claim notes or claimer names.
		items, err := appdb.GetItemsByUserID(db, user.ID, true)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		views := make([]models.ItemView, len(items))
		for i, item := range items {
			views[i] = models.ItemView{
				ID:                    item.ID,
				UserID:                item.UserID,
				Name:                  item.Name,
				Description:           item.Description,
				URL:                   item.URL,
				Price:                 item.Price,
				Currency:              item.Currency,
				ImageURL:              item.ImageURL,
				Priority:              item.Priority,
				IsReceived:            item.IsReceived,
				IsArchived:            item.IsArchived,
				SortOrder:             item.SortOrder,
				CreatedAt:             item.CreatedAt,
				AvailabilityStatus:    item.AvailabilityStatus,
				AvailabilityCheckedAt: item.AvailabilityCheckedAt,
			}
		}
		writeJSON(w, http.StatusOK, views)
	}
}

func GetUserItems(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		sessionUser := UserFromContext(r.Context())
		userID, err := strconv.ParseInt(chi.URLParam(r, "userId"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid userId"})
			return
		}
		if userID == sessionUser.ID {
			// Owner views use /mine because the response hides different fields.
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "use /api/items/mine for your own items"})
			return
		}
		items, err := appdb.GetItemsByUserID(db, userID, false)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		views := make([]models.ItemView, len(items))
		for i, item := range items {
			views[i] = itemToView(item, sessionUser.ID)
		}
		writeJSON(w, http.StatusOK, views)
	}
}

func CreateItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			URL         string `json:"url"`
			Price       string `json:"price"`
			Currency    string `json:"currency"`
			ImageURL    string `json:"imageUrl"`
			Priority    int    `json:"priority"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if len([]rune(body.Name)) > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name too long"})
			return
		}
		if len([]rune(body.Description)) > 500 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "description too long"})
			return
		}
		item, err := appdb.CreateItem(db, user.ID, body.Name, body.Description, body.URL, body.Price, body.Currency, body.ImageURL, body.Priority)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if status, checkedAt, ok := recentScrapeAvailability(body.URL); ok {
			if appdb.UpdateItemAvailability(db, item.ID, body.URL, status, checkedAt) == nil {
				item.AvailabilityStatus = status
				item.AvailabilityCheckedAt = checkedAt.UTC().Format(time.RFC3339)
			}
		} else {
			go refreshItemAvailability(db, item.ID, body.URL)
		}
		view := itemToView(*item, user.ID)
		writeJSON(w, http.StatusCreated, view)
	}
}

func UpdateItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		var body struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			URL         string `json:"url"`
			Price       string `json:"price"`
			Currency    string `json:"currency"`
			ImageURL    string `json:"imageUrl"`
			Priority    int    `json:"priority"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		if strings.TrimSpace(body.Name) == "" {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
			return
		}
		if len([]rune(body.Name)) > 100 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name too long"})
			return
		}
		if len([]rune(body.Description)) > 500 {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "description too long"})
			return
		}
		item, err := appdb.UpdateItem(db, id, body.Name, body.Description, body.URL, body.Price, body.Currency, body.ImageURL, body.Priority)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if status, checkedAt, ok := recentScrapeAvailability(body.URL); ok {
			if appdb.UpdateItemAvailability(db, item.ID, body.URL, status, checkedAt) == nil {
				item.AvailabilityStatus = status
				item.AvailabilityCheckedAt = checkedAt.UTC().Format(time.RFC3339)
			}
		} else if item.AvailabilityCheckedAt == "" {
			go refreshItemAvailability(db, item.ID, body.URL)
		}
		view := itemToView(*item, user.ID)
		writeJSON(w, http.StatusOK, view)
	}
}

func DeleteItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.DeleteItem(db, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func ClaimItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		var body struct {
			Note string `json:"note"`
		}
		json.NewDecoder(r.Body).Decode(&body)

		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID == user.ID {
			// Claiming your own gift would make the surprise rules confusing.
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "cannot claim own item"})
			return
		}
		if meta.claimedBy != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already claimed"})
			return
		}
		if err := appdb.ClaimItem(db, id, user.ID, body.Note); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func UpdateClaimNote(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		var body struct {
			Note string `json:"note"`
		}
		json.NewDecoder(r.Body).Decode(&body)

		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.claimedBy == nil || *meta.claimedBy != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.UpdateClaimNote(db, id, user.ID, body.Note); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func UnclaimItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.claimedBy == nil || *meta.claimedBy != user.ID {
			// Only the person who claimed the item can undo that claim.
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.UnclaimItem(db, id); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func PurchaseItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.claimedBy == nil || *meta.claimedBy != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.SetItemPurchased(db, id, true); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func UnpurchaseItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.claimedBy == nil || *meta.claimedBy != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.SetItemPurchased(db, id, false); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func ReceivedItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.SetItemReceived(db, id, true); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func UnreceivedItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.SetItemReceived(db, id, false); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func ArchiveItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.SetItemArchived(db, id, true); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func UnarchiveItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		id, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		meta, err := getItemMeta(db, id)
		if err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		if meta.userID != user.ID {
			writeJSON(w, http.StatusForbidden, map[string]string{"error": "forbidden"})
			return
		}
		if err := appdb.SetItemArchived(db, id, false); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

func ReorderItems(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		var body struct {
			IDs []int64 `json:"ids"`
		}
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
			return
		}
		// Missing ids are left in their old relative position. The UI sends the full
		// active list, so this is mainly a safety net.
		if err := appdb.ReorderItems(db, user.ID, body.IDs); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}
}

type itemMeta struct {
	userID      int64
	claimedBy   *int64
	isPurchased bool
	isReceived  bool
	isArchived  bool
}

func getItemMeta(db *sql.DB, id int64) (*itemMeta, error) {
	var meta itemMeta
	var claimedBy sql.NullInt64
	var purchased, received, archived int
	err := db.QueryRow(
		// Lightweight ownership/claim lookup for write endpoints.
		"SELECT user_id, claimed_by, COALESCE(is_purchased,0), COALESCE(is_received,0), COALESCE(is_archived,0) FROM items WHERE id = ?",
		id,
	).Scan(&meta.userID, &claimedBy, &purchased, &received, &archived)
	if err != nil {
		return nil, err
	}
	if claimedBy.Valid {
		meta.claimedBy = &claimedBy.Int64
	}
	meta.isPurchased = purchased == 1
	meta.isReceived = received == 1
	meta.isArchived = archived == 1
	return &meta, nil
}
