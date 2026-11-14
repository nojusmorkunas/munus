package db

import "github.com/nojusmorkunas/munus/models"

// PresetAvatars are the illustrations in frontend/public/avatars, without the
// .svg extension. The frontend keeps the same list in src/lib/avatars.ts for
// its picker. The tests check both lists match and every name has a file.
var PresetAvatars = []string{
	"fox", "cat", "bear", "panda", "rabbit", "owl",
	"frog", "penguin", "koala", "lion", "dog", "mouse",
	"pig", "raccoon", "tiger", "chick", "monkey", "sheep",
	"deer", "elephant", "hedgehog", "otter", "sloth", "giraffe",
	"cow", "hamster", "unicorn", "dinosaur", "axolotl", "redpanda",
}

// DefaultAvatarURL is the preset shown for someone who hasn't picked a picture.
// It goes by user id, so the first people on an install all get different ones
// and the choice never changes when they rename themselves. Add new presets at
// the end: then anyone whose id was within the old list keeps their default.
func DefaultAvatarURL(userID int64) string {
	n := int64(len(PresetAvatars))
	i := ((userID-1)%n + n) % n
	return "/avatars/" + PresetAvatars[i] + ".svg"
}

// withDefaultAvatar fills in the default preset when no picture is stored.
// Only reads go through it, and UpdateUserProfile doesn't store the default
// either, so a later change to the list still applies to everyone who never
// chose a picture.
func withDefaultAvatar(u *models.User) {
	if u.AvatarURL == "" {
		u.AvatarURL = DefaultAvatarURL(u.ID)
	}
}
