package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"testing"

	"github.com/go-chi/chi/v5"
	appdb "github.com/nojusmorkunas/munus/db"
	"github.com/nojusmorkunas/munus/models"
)

// testServer wires the item routes with a stand-in for RequireAuth: the
// X-Test-User header says who is making the request.
func testServer(t *testing.T) (*sql.DB, http.Handler) {
	t.Helper()
	db, err := appdb.Init(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })

	r := chi.NewRouter()
	r.Get("/api/public/{token}", GetPublicList(db))
	r.Group(func(r chi.Router) {
		r.Use(func(next http.Handler) http.Handler {
			return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
				id, _ := strconv.ParseInt(req.Header.Get("X-Test-User"), 10, 64)
				user, err := appdb.GetUserByID(db, id)
				if err != nil {
					w.WriteHeader(http.StatusUnauthorized)
					return
				}
				next.ServeHTTP(w, req.WithContext(context.WithValue(req.Context(), userContextKey, user)))
			})
		})
		r.Get("/api/items/mine", GetMyItems(db))
		r.Get("/api/items/user/{userId}", GetUserItems(db))
		r.Post("/api/items", CreateItem(db))
		r.Delete("/api/items/{id}", DeleteItem(db))
		r.Post("/api/items/{id}/claim", ClaimItem(db))
		r.Post("/api/items/{id}/accept", AcceptSuggestion(db))
		r.Post("/api/users/{id}/suggestions", CreateSuggestion(db))
		r.Get("/api/suggestions/count", SuggestionCount(db))
	})
	return db, r
}

func createUser(t *testing.T, db *sql.DB, name string) *models.User {
	t.Helper()
	u, err := appdb.CreateUser(db, name, "password", name, "", false)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func call(t *testing.T, h http.Handler, as *models.User, method, path string, body any) *httptest.ResponseRecorder {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	if as != nil {
		req.Header.Set("X-Test-User", strconv.FormatInt(as.ID, 10))
	}
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	return rec
}

func decode[T any](t *testing.T, rec *httptest.ResponseRecorder) T {
	t.Helper()
	var v T
	if err := json.Unmarshal(rec.Body.Bytes(), &v); err != nil {
		t.Fatalf("decode %q: %v", rec.Body.String(), err)
	}
	return v
}

func findItem(items []models.ItemView, id int64) *models.ItemView {
	for i := range items {
		if items[i].ID == id {
			return &items[i]
		}
	}
	return nil
}

func expectStatus(t *testing.T, rec *httptest.ResponseRecorder, want int, what string) {
	t.Helper()
	if rec.Code != want {
		t.Fatalf("%s: status %d, want %d (body %s)", what, rec.Code, want, rec.Body.String())
	}
}

func TestSuggestionLifecycle(t *testing.T) {
	db, h := testServer(t)
	emma := createUser(t, db, "emma")
	alex := createUser(t, db, "alex")
	lukas := createUser(t, db, "lukas")

	// Emma already has one item, so we can check where accepted suggestions land.
	expectStatus(t, call(t, h, emma, "POST", "/api/items", map[string]any{"name": "Book"}), http.StatusCreated, "create item")

	rec := call(t, h, alex, "POST", fmt.Sprintf("/api/users/%d/suggestions", emma.ID), map[string]any{
		"name": "Wool sweater", "price": "80", "note": "Thought you'd like this", "details": "ignored",
	})
	expectStatus(t, rec, http.StatusCreated, "suggest")
	suggestion := decode[models.ItemView](t, rec)
	if !suggestion.IsPending || !suggestion.SuggestedByMe || suggestion.Details != "" {
		t.Fatalf("suggester's view of new suggestion: %+v", suggestion)
	}

	// Emma sees it as pending, with who sent it and their note.
	mine := decode[[]models.ItemView](t, call(t, h, emma, "GET", "/api/items/mine", nil))
	got := findItem(mine, suggestion.ID)
	if got == nil || !got.IsPending || got.SuggestedByName != "alex" || got.SuggestionNote != "Thought you'd like this" {
		t.Fatalf("owner's view of pending suggestion: %+v", got)
	}
	if count := decode[map[string]int](t, call(t, h, emma, "GET", "/api/suggestions/count", nil)); count["count"] != 1 {
		t.Fatalf("pending count = %d, want 1", count["count"])
	}

	// Nobody else can see it yet: not other viewers, not the share link.
	if findItem(decode[[]models.ItemView](t, call(t, h, lukas, "GET", fmt.Sprintf("/api/items/user/%d", emma.ID), nil)), suggestion.ID) != nil {
		t.Fatal("another viewer can see a pending suggestion")
	}
	emmaFull, _ := appdb.GetUserByID(db, emma.ID)
	public := decode[struct {
		Items []publicItemView `json:"items"`
	}](t, call(t, h, nil, "GET", "/api/public/"+emmaFull.PublicToken, nil))
	for _, item := range public.Items {
		if item.ID == suggestion.ID {
			t.Fatal("share link shows a pending suggestion")
		}
	}
	// The suggester still sees their own suggestion while it waits.
	if got := findItem(decode[[]models.ItemView](t, call(t, h, alex, "GET", fmt.Sprintf("/api/items/user/%d", emma.ID), nil)), suggestion.ID); got == nil || !got.IsPending {
		t.Fatalf("suggester's view while pending: %+v", got)
	}

	// While pending: nobody can claim it, other people can't remove it, and
	// only Emma can accept it.
	expectStatus(t, call(t, h, lukas, "POST", fmt.Sprintf("/api/items/%d/claim", suggestion.ID), nil), http.StatusConflict, "claim pending")
	expectStatus(t, call(t, h, lukas, "DELETE", fmt.Sprintf("/api/items/%d", suggestion.ID), nil), http.StatusForbidden, "third party delete")
	expectStatus(t, call(t, h, alex, "POST", fmt.Sprintf("/api/items/%d/accept", suggestion.ID), map[string]any{"name": "x"}), http.StatusForbidden, "suggester accept")

	// Emma accepts it and picks her size.
	rec = call(t, h, emma, "POST", fmt.Sprintf("/api/items/%d/accept", suggestion.ID), map[string]any{
		"name": "Wool sweater", "price": "80", "details": "Size M, black",
	})
	expectStatus(t, rec, http.StatusOK, "accept")
	if accepted := decode[models.ItemView](t, rec); accepted.IsPending || accepted.Details != "Size M, black" {
		t.Fatalf("accepted item: %+v", accepted)
	}
	expectStatus(t, call(t, h, emma, "POST", fmt.Sprintf("/api/items/%d/accept", suggestion.ID), map[string]any{"name": "x"}), http.StatusConflict, "accept twice")
	if count := decode[map[string]int](t, call(t, h, emma, "GET", "/api/suggestions/count", nil)); count["count"] != 0 {
		t.Fatalf("pending count after accept = %d, want 0", count["count"])
	}

	// Accepted suggestions go to the top of the list.
	var active []models.ItemView
	for _, item := range decode[[]models.ItemView](t, call(t, h, emma, "GET", "/api/items/mine", nil)) {
		if !item.IsPending {
			active = append(active, item)
		}
	}
	if len(active) != 2 || active[0].ID != suggestion.ID {
		t.Fatalf("accepted suggestion should be first: %+v", active)
	}

	// Now everyone sees it with Emma's size, but not who suggested it.
	got = findItem(decode[[]models.ItemView](t, call(t, h, lukas, "GET", fmt.Sprintf("/api/items/user/%d", emma.ID), nil)), suggestion.ID)
	if got == nil || got.IsPending || got.Details != "Size M, black" || got.SuggestedByName != "" || got.SuggestionNote != "" {
		t.Fatalf("viewer's view of accepted suggestion: %+v", got)
	}
	// Once accepted it belongs to Emma, so Alex can't withdraw it any more.
	expectStatus(t, call(t, h, alex, "DELETE", fmt.Sprintf("/api/items/%d", suggestion.ID), nil), http.StatusForbidden, "withdraw after accept")
	expectStatus(t, call(t, h, lukas, "POST", fmt.Sprintf("/api/items/%d/claim", suggestion.ID), nil), http.StatusNoContent, "claim accepted")
}

func TestSuggestionWithdrawDismissAndSelf(t *testing.T) {
	db, h := testServer(t)
	emma := createUser(t, db, "emma")
	alex := createUser(t, db, "alex")

	expectStatus(t, call(t, h, emma, "POST", fmt.Sprintf("/api/users/%d/suggestions", emma.ID), map[string]any{"name": "x"}), http.StatusBadRequest, "suggest to self")
	expectStatus(t, call(t, h, alex, "POST", "/api/users/9999/suggestions", map[string]any{"name": "x"}), http.StatusNotFound, "suggest to nobody")
	expectStatus(t, call(t, h, alex, "POST", fmt.Sprintf("/api/users/%d/suggestions", emma.ID), map[string]any{"name": ""}), http.StatusBadRequest, "suggest without name")

	first := decode[models.ItemView](t, call(t, h, alex, "POST", fmt.Sprintf("/api/users/%d/suggestions", emma.ID), map[string]any{"name": "One"}))
	second := decode[models.ItemView](t, call(t, h, alex, "POST", fmt.Sprintf("/api/users/%d/suggestions", emma.ID), map[string]any{"name": "Two"}))

	expectStatus(t, call(t, h, alex, "DELETE", fmt.Sprintf("/api/items/%d", first.ID), nil), http.StatusNoContent, "suggester withdraws")
	expectStatus(t, call(t, h, emma, "DELETE", fmt.Sprintf("/api/items/%d", second.ID), nil), http.StatusNoContent, "owner dismisses")
	if mine := decode[[]models.ItemView](t, call(t, h, emma, "GET", "/api/items/mine", nil)); len(mine) != 0 {
		t.Fatalf("suggestions should be gone: %+v", mine)
	}
}

func TestClaimIsFirstComeFirstServed(t *testing.T) {
	db, _ := testServer(t)
	emma := createUser(t, db, "emma")
	alex := createUser(t, db, "alex")
	lukas := createUser(t, db, "lukas")
	item, err := appdb.CreateItem(db, emma.ID, appdb.ItemFields{Name: "Lamp"})
	if err != nil {
		t.Fatal(err)
	}
	// Both claimers passed the handler's "is it claimed?" check; only the first
	// update may win.
	if ok, err := appdb.ClaimItem(db, item.ID, alex.ID, ""); err != nil || !ok {
		t.Fatalf("first claim: ok=%v err=%v", ok, err)
	}
	if ok, err := appdb.ClaimItem(db, item.ID, lukas.ID, ""); err != nil || ok {
		t.Fatalf("second claim: ok=%v err=%v", ok, err)
	}
	stored, _ := appdb.GetItemByID(db, item.ID)
	if stored.ClaimedBy == nil || *stored.ClaimedBy != alex.ID {
		t.Fatalf("claim was overwritten: %+v", stored.ClaimedBy)
	}
}
