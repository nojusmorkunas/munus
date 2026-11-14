package db

import (
	"database/sql"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

func TestDefaultAvatar(t *testing.T) {
	database, err := Init(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()

	first, err := CreateUser(database, "first", "password", "First", "", false)
	if err != nil {
		t.Fatal(err)
	}
	second, err := CreateUser(database, "second", "password", "Second", "", false)
	if err != nil {
		t.Fatal(err)
	}
	if first.AvatarURL != DefaultAvatarURL(first.ID) || second.AvatarURL != DefaultAvatarURL(second.ID) {
		t.Fatalf("new users got %q and %q, want their defaults", first.AvatarURL, second.AvatarURL)
	}
	if first.AvatarURL == second.AvatarURL {
		t.Fatalf("consecutive users share the default %q", first.AvatarURL)
	}

	// Saving the profile with the default showing doesn't store it as a choice.
	if _, err := UpdateUserProfile(database, first.ID, "first", "First", "", "", "", first.AvatarURL); err != nil {
		t.Fatal(err)
	}
	var stored sql.NullString
	if err := database.QueryRow("SELECT avatar_url FROM users WHERE id = ?", first.ID).Scan(&stored); err != nil {
		t.Fatal(err)
	}
	if stored.Valid {
		t.Fatalf("saving with the default stored %q", stored.String)
	}

	// A chosen picture replaces the default, and clearing it brings the default back.
	updated, err := UpdateUserProfile(database, first.ID, "first", "First", "", "", "", "/uploads/me.jpg")
	if err != nil {
		t.Fatal(err)
	}
	if updated.AvatarURL != "/uploads/me.jpg" {
		t.Fatalf("chosen picture = %q", updated.AvatarURL)
	}
	cleared, err := UpdateUserProfile(database, first.ID, "first", "First", "", "", "", "")
	if err != nil {
		t.Fatal(err)
	}
	if cleared.AvatarURL != DefaultAvatarURL(first.ID) {
		t.Fatalf("after clearing = %q, want the default", cleared.AvatarURL)
	}

	all, err := GetAllUsers(database)
	if err != nil {
		t.Fatal(err)
	}
	for _, u := range all {
		if u.AvatarURL == "" {
			t.Fatalf("GetAllUsers left %q without a picture", u.Username)
		}
	}
}

func TestDefaultAvatarCyclesThroughPresets(t *testing.T) {
	n := int64(len(PresetAvatars))
	if DefaultAvatarURL(1) != "/avatars/"+PresetAvatars[0]+".svg" {
		t.Fatalf("user 1 = %q", DefaultAvatarURL(1))
	}
	if DefaultAvatarURL(1+n) != DefaultAvatarURL(1) {
		t.Fatal("the list should wrap around after the last preset")
	}
}

// The picker's list in the frontend must match this one, in the same order.
func TestPresetAvatarListsMatch(t *testing.T) {
	src, err := os.ReadFile(filepath.Join("..", "..", "frontend", "src", "lib", "avatars.ts"))
	if err != nil {
		t.Fatal(err)
	}
	block := regexp.MustCompile(`(?s)PRESET_AVATARS = \[(.*?)\]`).FindSubmatch(src)
	if block == nil {
		t.Fatal("PRESET_AVATARS not found in avatars.ts")
	}
	var frontend []string
	for _, m := range regexp.MustCompile(`"([a-z]+)"`).FindAllSubmatch(block[1], -1) {
		frontend = append(frontend, string(m[1]))
	}
	if strings.Join(frontend, ",") != strings.Join(PresetAvatars, ",") {
		t.Fatalf("frontend list %v\ndoesn't match backend list %v", frontend, PresetAvatars)
	}
}

func TestPresetAvatarFilesExist(t *testing.T) {
	for _, name := range PresetAvatars {
		path := filepath.Join("..", "..", "frontend", "public", "avatars", name+".svg")
		if _, err := os.Stat(path); err != nil {
			t.Errorf("preset %q has no file: %v", name, err)
		}
	}
}
