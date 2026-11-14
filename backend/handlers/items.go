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
	suggestedByMe := item.SuggestedBy != nil && *item.SuggestedBy == sessionUserID
	var claimNote, claimedByName, suggestionNote string
	var isPurchased bool
	if suggestedByMe {
		suggestionNote = item.SuggestionNote
	}
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
		Details:               item.Details,
		IsPending:             item.IsPending,
		SuggestedByMe:         suggestedByMe,
		SuggestionNote:        suggestionNote,
	}
}

// ownerItemView is what list owners see of their own items: everything except
// who claimed it, whether it was bought, and the claimer's note.
func ownerItemView(item models.Item) models.ItemView {
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
		IsReceived:            item.IsReceived,
		IsArchived:            item.IsArchived,
		SortOrder:             item.SortOrder,
		CreatedAt:             item.CreatedAt,
		AvailabilityStatus:    item.AvailabilityStatus,
		AvailabilityCheckedAt: item.AvailabilityCheckedAt,
		Details:               item.Details,
		IsPending:             item.IsPending,
		SuggestedByName:       item.SuggestedByName,
		SuggestionNote:        item.SuggestionNote,
	}
}

func GetMyItems(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		// The owner can see archived items, but not claim notes or claimer names.
		// Pending suggestions come first so the page can show them above the list.
		pending, err := appdb.GetPendingSuggestions(db, user.ID, 0)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		items, err := appdb.GetItemsByUserID(db, user.ID, true)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		views := make([]models.ItemView, 0, len(pending)+len(items))
		for _, item := range append(pending, items...) {
			views = append(views, ownerItemView(item))
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
		// Viewers also see suggestions they sent that are still waiting, and only
		// those: other people's suggestions stay private until accepted.
		mine, err := appdb.GetPendingSuggestions(db, userID, sessionUser.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		views := make([]models.ItemView, 0, len(items)+len(mine))
		for _, item := range append(items, mine...) {
			views = append(views, itemToView(item, sessionUser.ID))
		}
		writeJSON(w, http.StatusOK, views)
	}
}

func CreateItem(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		fields, ok := decodeItemFields(w, r, nil)
		if !ok {
			return
		}
		item, err := appdb.CreateItem(db, user.ID, fields)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		applyNewItemAvailability(db, item)
		writeJSON(w, http.StatusCreated, ownerItemView(*item))
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
		fields, ok := decodeItemFields(w, r, nil)
		if !ok {
			return
		}
		item, err := appdb.UpdateItem(db, id, fields)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		applyChangedItemAvailability(db, item)
		writeJSON(w, http.StatusOK, ownerItemView(*item))
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
		// Owners can delete anything on their list, which is also how they turn
		// down a suggestion. Suggesters can withdraw a suggestion until it is accepted.
		withdrawing := meta.isPending && meta.suggestedBy != nil && *meta.suggestedBy == user.ID
		if meta.userID != user.ID && !withdrawing {
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
		if meta.isPending {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "not on the list yet"})
			return
		}
		if meta.claimedBy != nil {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already claimed"})
			return
		}
		claimed, err := appdb.ClaimItem(db, id, user.ID, body.Note)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if !claimed {
			// Someone else claimed it between the check above and the update.
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already claimed"})
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
	suggestedBy *int64
	isPurchased bool
	isReceived  bool
	isArchived  bool
	isPending   bool
}

func getItemMeta(db *sql.DB, id int64) (*itemMeta, error) {
	var meta itemMeta
	var claimedBy, suggestedBy sql.NullInt64
	var purchased, received, archived, pending int
	err := db.QueryRow(
		// Lightweight ownership/claim lookup for write endpoints.
		`SELECT user_id, claimed_by, suggested_by, COALESCE(is_purchased,0), COALESCE(is_received,0),
		 COALESCE(is_archived,0), COALESCE(is_pending,0) FROM items WHERE id = ?`,
		id,
	).Scan(&meta.userID, &claimedBy, &suggestedBy, &purchased, &received, &archived, &pending)
	if err != nil {
		return nil, err
	}
	if claimedBy.Valid {
		meta.claimedBy = &claimedBy.Int64
	}
	if suggestedBy.Valid {
		meta.suggestedBy = &suggestedBy.Int64
	}
	meta.isPending = pending == 1
	meta.isPurchased = purchased == 1
	meta.isReceived = received == 1
	meta.isArchived = archived == 1
	return &meta, nil
}

// itemFieldsBody is the JSON shape for creating, editing, suggesting and
// accepting items.
type itemFieldsBody struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	URL         string `json:"url"`
	Price       string `json:"price"`
	Currency    string `json:"currency"`
	ImageURL    string `json:"imageUrl"`
	Details     string `json:"details"`
	Priority    int    `json:"priority"`
	Note        string `json:"note"`
}

// decodeItemFields reads and validates an item body. It writes the error
// response itself and returns ok=false when the request should stop. Pass a
// non-nil note to also accept a suggestion note.
func decodeItemFields(w http.ResponseWriter, r *http.Request, note *string) (appdb.ItemFields, bool) {
	var body itemFieldsBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid body"})
		return appdb.ItemFields{}, false
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Details = strings.TrimSpace(body.Details)
	body.Note = strings.TrimSpace(body.Note)
	switch {
	case body.Name == "":
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return appdb.ItemFields{}, false
	case len([]rune(body.Name)) > 100:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name too long"})
		return appdb.ItemFields{}, false
	case len([]rune(body.Description)) > 500:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "description too long"})
		return appdb.ItemFields{}, false
	case len([]rune(body.Details)) > 100:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "details too long"})
		return appdb.ItemFields{}, false
	case len([]rune(body.Note)) > 300:
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "note too long"})
		return appdb.ItemFields{}, false
	}
	if note != nil {
		*note = body.Note
	}
	return appdb.ItemFields{
		Name:        body.Name,
		Description: body.Description,
		URL:         body.URL,
		Price:       body.Price,
		Currency:    body.Currency,
		ImageURL:    body.ImageURL,
		Details:     body.Details,
		Priority:    body.Priority,
	}, true
}

// applyNewItemAvailability reuses a fresh scrape result for a new item, or
// checks the link in the background.
func applyNewItemAvailability(db *sql.DB, item *models.Item) {
	if status, checkedAt, ok := recentScrapeAvailability(item.URL); ok {
		if appdb.UpdateItemAvailability(db, item.ID, item.URL, status, checkedAt) == nil {
			item.AvailabilityStatus = status
			item.AvailabilityCheckedAt = checkedAt.UTC().Format(time.RFC3339)
		}
		return
	}
	go refreshItemAvailability(db, item.ID, item.URL)
}

// applyChangedItemAvailability is the edit version: a link that was already
// checked keeps its result until the next scheduled check.
func applyChangedItemAvailability(db *sql.DB, item *models.Item) {
	if status, checkedAt, ok := recentScrapeAvailability(item.URL); ok {
		if appdb.UpdateItemAvailability(db, item.ID, item.URL, status, checkedAt) == nil {
			item.AvailabilityStatus = status
			item.AvailabilityCheckedAt = checkedAt.UTC().Format(time.RFC3339)
		}
		return
	}
	if item.AvailabilityCheckedAt == "" {
		go refreshItemAvailability(db, item.ID, item.URL)
	}
}

// CreateSuggestion lets a logged-in user suggest an item for someone else's
// list. It stays pending, visible only to the two of them, until the owner
// accepts or dismisses it.
func CreateSuggestion(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		ownerID, err := strconv.ParseInt(chi.URLParam(r, "id"), 10, 64)
		if err != nil {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid id"})
			return
		}
		if ownerID == user.ID {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "add items to your own list directly"})
			return
		}
		if _, err := appdb.GetUserByID(db, ownerID); err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "not found"})
			return
		}
		var note string
		fields, ok := decodeItemFields(w, r, &note)
		if !ok {
			return
		}
		// The owner picks size and colour when accepting, not the suggester.
		fields.Details = ""
		item, err := appdb.CreateSuggestion(db, ownerID, user.ID, fields, note)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		applyNewItemAvailability(db, item)
		writeJSON(w, http.StatusCreated, itemToView(*item, user.ID))
	}
}

// AcceptSuggestion saves the owner's edits (size, colour, the exact variant
// link) and moves the suggestion onto their list in one step.
func AcceptSuggestion(db *sql.DB) http.HandlerFunc {
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
		if !meta.isPending {
			writeJSON(w, http.StatusConflict, map[string]string{"error": "already on your list"})
			return
		}
		fields, ok := decodeItemFields(w, r, nil)
		if !ok {
			return
		}
		if _, err := appdb.UpdateItem(db, id, fields); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		if err := appdb.AcceptSuggestion(db, id, user.ID); err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		item, err := appdb.GetItemByID(db, id)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		applyChangedItemAvailability(db, item)
		writeJSON(w, http.StatusOK, ownerItemView(*item))
	}
}

// SuggestionCount powers the badge on the My List tab.
func SuggestionCount(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user := UserFromContext(r.Context())
		n, err := appdb.CountPendingSuggestions(db, user.ID)
		if err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "internal error"})
			return
		}
		writeJSON(w, http.StatusOK, map[string]int{"count": n})
	}
}
