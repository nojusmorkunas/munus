package db

import (
	"path/filepath"
	"testing"
	"time"
)

func TestItemAvailabilityLifecycle(t *testing.T) {
	database, err := Init(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	item, err := CreateItem(database, 1, ItemFields{Name: "Gift", URL: "https://shop.example/item", Currency: "EUR"})
	if err != nil {
		t.Fatal(err)
	}
	if item.AvailabilityStatus != "unknown" || item.AvailabilityCheckedAt != "" {
		t.Fatalf("new item availability = %q at %q", item.AvailabilityStatus, item.AvailabilityCheckedAt)
	}

	checkedAt := time.Now().UTC().Truncate(time.Second)
	if err := UpdateItemAvailability(database, item.ID, item.URL, "unavailable", checkedAt); err != nil {
		t.Fatal(err)
	}
	items, err := GetItemsByUserID(database, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	if len(items) != 1 || items[0].AvailabilityStatus != "unavailable" || items[0].AvailabilityCheckedAt == "" {
		t.Fatalf("stored availability was not returned: %+v", items)
	}

	// A result for an old URL must not overwrite the item after its link changes.
	if _, err := UpdateItem(database, item.ID, ItemFields{Name: item.Name, URL: "https://other.example/item", Currency: item.Currency}); err != nil {
		t.Fatal(err)
	}
	if err := UpdateItemAvailability(database, item.ID, item.URL, "unavailable", time.Now()); err != nil {
		t.Fatal(err)
	}
	items, err = GetItemsByUserID(database, 1, true)
	if err != nil {
		t.Fatal(err)
	}
	if items[0].AvailabilityStatus != "unknown" || items[0].AvailabilityCheckedAt != "" {
		t.Fatalf("changed URL retained stale availability: %+v", items[0])
	}
}
