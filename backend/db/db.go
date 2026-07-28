package db

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"github.com/nojusmorkunas/munus/models"
	"golang.org/x/crypto/bcrypt"
	_ "modernc.org/sqlite"
)

// The base schema is intentionally small. Older installs get extra columns from
// the simple migration list below.
const schema = `
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    display_name  TEXT NOT NULL,
    birthday      TEXT,
    is_admin      INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS signup_tokens (
    id         TEXT PRIMARY KEY,
    expires_at TEXT NOT NULL,
    used       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    name        TEXT NOT NULL,
    description TEXT,
    url         TEXT,
    price       TEXT,
    claimed_by  INTEGER,
    created_at  TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (claimed_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
`

var migrations = []string{
	"ALTER TABLE items ADD COLUMN image_url TEXT",
	"ALTER TABLE items ADD COLUMN priority INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE items ADD COLUMN claim_note TEXT",
	"ALTER TABLE items ADD COLUMN is_purchased INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE items ADD COLUMN is_received INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE items ADD COLUMN is_archived INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE items ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0",
	"ALTER TABLE users ADD COLUMN currency TEXT",
	"ALTER TABLE users ADD COLUMN locale TEXT",
	"ALTER TABLE users ADD COLUMN avatar_url TEXT",
	"ALTER TABLE items ADD COLUMN currency TEXT",
	"ALTER TABLE users ADD COLUMN public_token TEXT",
	"ALTER TABLE items ADD COLUMN availability_status TEXT NOT NULL DEFAULT 'unknown'",
	"ALTER TABLE items ADD COLUMN availability_checked_at TEXT",
}

func Init(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec(schema); err != nil {
		return nil, err
	}
	// These ALTER TABLE calls are allowed to fail when a column already exists.
	// That keeps startup idempotent without a separate migration table.
	for _, m := range migrations {
		db.Exec(m)
	}
	return db, nil
}

func SeedAdmin(db *sql.DB, username, password, displayName string) error {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM users").Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		// Only create the first admin. Later password changes happen through the app.
		return nil
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = db.Exec(
		"INSERT INTO users (username, password_hash, display_name, is_admin) VALUES (?, ?, ?, 1)",
		username, string(hash), displayName,
	)
	return err
}

func SeedSettings(db *sql.DB) error {
	for _, pair := range [][2]string{{"currency", "EUR"}, {"locale", "lt-LT"}} {
		db.Exec("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", pair[0], pair[1])
	}
	return nil
}

func EnsurePublicTokens(db *sql.DB) {
	// Public share links were added after the first schema, so old users may not
	// have tokens yet.
	rows, _ := db.Query("SELECT id FROM users WHERE public_token IS NULL OR public_token = ''")
	if rows == nil {
		return
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		rows.Scan(&id)
		ids = append(ids, id)
	}
	for _, id := range ids {
		db.Exec("UPDATE users SET public_token = ? WHERE id = ?", uuid.NewString(), id)
	}
}

func GetUserByPublicToken(db *sql.DB, token string) (*models.User, error) {
	var u models.User
	var birthday sql.NullString
	err := db.QueryRow(
		"SELECT id, username, display_name, birthday, is_admin, COALESCE(currency,''), COALESCE(locale,''), COALESCE(avatar_url,''), COALESCE(public_token,'') FROM users WHERE public_token = ?",
		token,
	).Scan(&u.ID, &u.Username, &u.DisplayName, &birthday, &u.IsAdmin, &u.Currency, &u.Locale, &u.AvatarURL, &u.PublicToken)
	if err != nil {
		return nil, err
	}
	u.Birthday = birthday.String
	return &u, nil
}

func GetAllSettings(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query("SELECT key, value FROM settings")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := make(map[string]string)
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		result[k] = v
	}
	return result, rows.Err()
}

func SetSetting(db *sql.DB, key, value string) error {
	_, err := db.Exec("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", key, value)
	return err
}

func GetUserByUsername(db *sql.DB, username string) (*models.User, string, error) {
	var u models.User
	var hash string
	var birthday sql.NullString
	err := db.QueryRow(
		"SELECT id, username, password_hash, display_name, birthday, is_admin, COALESCE(currency,''), COALESCE(locale,''), COALESCE(avatar_url,'') FROM users WHERE username = ?",
		username,
	).Scan(&u.ID, &u.Username, &hash, &u.DisplayName, &birthday, &u.IsAdmin, &u.Currency, &u.Locale, &u.AvatarURL)
	if err != nil {
		return nil, "", err
	}
	u.Birthday = birthday.String
	return &u, hash, nil
}

func GetUserByID(db *sql.DB, id int64) (*models.User, error) {
	var u models.User
	var birthday sql.NullString
	err := db.QueryRow(
		"SELECT id, username, display_name, birthday, is_admin, COALESCE(currency,''), COALESCE(locale,''), COALESCE(avatar_url,''), COALESCE(public_token,'') FROM users WHERE id = ?",
		id,
	).Scan(&u.ID, &u.Username, &u.DisplayName, &birthday, &u.IsAdmin, &u.Currency, &u.Locale, &u.AvatarURL, &u.PublicToken)
	if err != nil {
		return nil, err
	}
	u.Birthday = birthday.String
	return &u, nil
}

func GetAllUsers(db *sql.DB) ([]models.User, error) {
	rows, err := db.Query("SELECT id, username, display_name, birthday, is_admin, COALESCE(avatar_url,'') FROM users ORDER BY display_name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var users []models.User
	for rows.Next() {
		var u models.User
		var birthday sql.NullString
		if err := rows.Scan(&u.ID, &u.Username, &u.DisplayName, &birthday, &u.IsAdmin, &u.AvatarURL); err != nil {
			return nil, err
		}
		u.Birthday = birthday.String
		users = append(users, u)
	}
	return users, rows.Err()
}

func CreateUser(db *sql.DB, username, password, displayName, birthday string, isAdmin bool) (*models.User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	adminInt := 0
	if isAdmin {
		adminInt = 1
	}
	var birthdayVal interface{}
	if birthday != "" {
		birthdayVal = birthday
	}
	res, err := db.Exec(
		"INSERT INTO users (username, password_hash, display_name, birthday, is_admin, public_token) VALUES (?, ?, ?, ?, ?, ?)",
		username, string(hash), displayName, birthdayVal, adminInt, uuid.NewString(),
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return GetUserByID(db, id)
}

func DeleteUser(db *sql.DB, id int64) error {
	_, err := db.Exec("DELETE FROM users WHERE id = ?", id)
	return err
}

func UpdateUserPassword(db *sql.DB, id int64, password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = db.Exec("UPDATE users SET password_hash = ? WHERE id = ?", string(hash), id)
	return err
}

func UpdateUserProfile(db *sql.DB, userID int64, username, displayName, birthday, currency, locale, avatarURL string) (*models.User, error) {
	var birthdayVal, currencyVal, localeVal, avatarVal interface{}
	if birthday != "" {
		birthdayVal = birthday
	}
	if currency != "" {
		currencyVal = currency
	}
	if locale != "" {
		localeVal = locale
	}
	if avatarURL != "" {
		avatarVal = avatarURL
	}
	_, err := db.Exec(
		"UPDATE users SET username = ?, display_name = ?, birthday = ?, currency = ?, locale = ?, avatar_url = ? WHERE id = ?",
		username, displayName, birthdayVal, currencyVal, localeVal, avatarVal, userID,
	)
	if err != nil {
		return nil, err
	}
	return GetUserByID(db, userID)
}

func GetUserPasswordHash(db *sql.DB, userID int64) (string, error) {
	var hash string
	err := db.QueryRow("SELECT password_hash FROM users WHERE id = ?", userID).Scan(&hash)
	return hash, err
}

func CreateSession(db *sql.DB, id string, userID int64, expiresAt time.Time) error {
	_, err := db.Exec(
		"INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
		id, userID, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

func GetSession(db *sql.DB, id string) (*models.Session, error) {
	var s models.Session
	var expiresAt string
	err := db.QueryRow("SELECT id, user_id, expires_at FROM sessions WHERE id = ?", id).
		Scan(&s.ID, &s.UserID, &expiresAt)
	if err != nil {
		return nil, err
	}
	s.ExpiresAt, err = time.Parse(time.RFC3339, expiresAt)
	if err != nil {
		return nil, err
	}
	return &s, nil
}

func DeleteSession(db *sql.DB, id string) error {
	_, err := db.Exec("DELETE FROM sessions WHERE id = ?", id)
	return err
}

// One shared SELECT keeps the item shape the same for owner, viewer and public
// list queries.
const itemSelect = `SELECT i.id, i.user_id, i.name,
	COALESCE(i.description,''), COALESCE(i.url,''), COALESCE(i.price,''), COALESCE(i.image_url,''),
	COALESCE(i.priority,0), COALESCE(i.claim_note,''), COALESCE(i.is_purchased,0),
	COALESCE(i.is_received,0), COALESCE(i.is_archived,0), COALESCE(i.sort_order,0),
	i.claimed_by, i.created_at, COALESCE(i.currency,''), COALESCE(u.display_name,''),
	COALESCE(i.availability_status,'unknown'), COALESCE(i.availability_checked_at,'')
	FROM items i LEFT JOIN users u ON i.claimed_by = u.id`

func scanItem(row interface {
	Scan(...any) error
}) (*models.Item, error) {
	var item models.Item
	var claimedBy sql.NullInt64
	var purchased, received, archived int
	err := row.Scan(
		&item.ID, &item.UserID, &item.Name, &item.Description, &item.URL, &item.Price, &item.ImageURL,
		&item.Priority, &item.ClaimNote, &purchased, &received, &archived, &item.SortOrder,
		&claimedBy, &item.CreatedAt, &item.Currency, &item.ClaimedByName,
		&item.AvailabilityStatus, &item.AvailabilityCheckedAt,
	)
	if err != nil {
		return nil, err
	}
	if claimedBy.Valid {
		item.ClaimedBy = &claimedBy.Int64
	}
	// SQLite stores booleans as 0/1, but the rest of the app uses bools.
	item.IsPurchased = purchased == 1
	item.IsReceived = received == 1
	item.IsArchived = archived == 1
	return &item, nil
}

func GetItemsByUserID(db *sql.DB, userID int64, includeArchived bool) ([]models.Item, error) {
	q := itemSelect + " WHERE i.user_id = ?"
	if !includeArchived {
		q += " AND i.is_archived = 0"
	}
	q += " ORDER BY i.sort_order ASC, i.created_at DESC"

	rows, err := db.Query(q, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []models.Item
	for rows.Next() {
		item, err := scanItem(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func CreateItem(db *sql.DB, userID int64, name, description, url, price, currency, imageURL string, priority int) (*models.Item, error) {
	res, err := db.Exec(
		"INSERT INTO items (user_id, name, description, url, price, currency, image_url, priority) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
		userID, name, description, url, price, currency, imageURL, priority,
	)
	if err != nil {
		return nil, err
	}
	id, _ := res.LastInsertId()
	return getItemByID(db, id)
}

func UpdateItem(db *sql.DB, id int64, name, description, url, price, currency, imageURL string, priority int) (*models.Item, error) {
	_, err := db.Exec(
		`UPDATE items SET name = ?, description = ?, url = ?, price = ?, currency = ?, image_url = ?, priority = ?,
		 availability_status = CASE WHEN COALESCE(url,'') <> ? THEN 'unknown' ELSE availability_status END,
		 availability_checked_at = CASE WHEN COALESCE(url,'') <> ? THEN NULL ELSE availability_checked_at END
		 WHERE id = ?`,
		name, description, url, price, currency, imageURL, priority, url, url, id,
	)
	if err != nil {
		return nil, err
	}
	return getItemByID(db, id)
}

type AvailabilityCheckItem struct {
	ID  int64
	URL string
}

// GetItemsDueForAvailabilityCheck returns only active, unreceived items. The
// saved URL is carried through to the update so an in-flight check cannot write
// a result after the owner changes the link.
func GetItemsDueForAvailabilityCheck(db *sql.DB, checkedBefore time.Time, limit int) ([]AvailabilityCheckItem, error) {
	rows, err := db.Query(`SELECT id, url FROM items
		WHERE COALESCE(url,'') <> '' AND COALESCE(is_archived,0) = 0 AND COALESCE(is_received,0) = 0
		AND (availability_checked_at IS NULL OR availability_checked_at = '' OR availability_checked_at < ?)
		ORDER BY COALESCE(availability_checked_at,'') ASC LIMIT ?`,
		checkedBefore.UTC().Format(time.RFC3339), limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var items []AvailabilityCheckItem
	for rows.Next() {
		var item AvailabilityCheckItem
		if err := rows.Scan(&item.ID, &item.URL); err != nil {
			return nil, err
		}
		items = append(items, item)
	}
	return items, rows.Err()
}

func UpdateItemAvailability(db *sql.DB, id int64, checkedURL, status string, checkedAt time.Time) error {
	_, err := db.Exec(`UPDATE items SET availability_status = ?, availability_checked_at = ?
		WHERE id = ? AND url = ?`, status, checkedAt.UTC().Format(time.RFC3339), id, checkedURL)
	return err
}

func DeleteItem(db *sql.DB, id int64) error {
	_, err := db.Exec("DELETE FROM items WHERE id = ?", id)
	return err
}

func ClaimItem(db *sql.DB, itemID, claimerID int64, note string) error {
	var noteVal interface{}
	if note != "" {
		noteVal = note
	}
	_, err := db.Exec("UPDATE items SET claimed_by = ?, claim_note = ? WHERE id = ?", claimerID, noteVal, itemID)
	return err
}

func UpdateClaimNote(db *sql.DB, itemID, claimerID int64, note string) error {
	var noteVal interface{}
	if note != "" {
		noteVal = note
	}
	_, err := db.Exec("UPDATE items SET claim_note = ? WHERE id = ? AND claimed_by = ?", noteVal, itemID, claimerID)
	return err
}

func UnclaimItem(db *sql.DB, itemID int64) error {
	_, err := db.Exec("UPDATE items SET claimed_by = NULL, claim_note = NULL, is_purchased = 0 WHERE id = ?", itemID)
	return err
}

func SetItemPurchased(db *sql.DB, itemID int64, purchased bool) error {
	v := 0
	if purchased {
		v = 1
	}
	_, err := db.Exec("UPDATE items SET is_purchased = ? WHERE id = ?", v, itemID)
	return err
}

func SetItemReceived(db *sql.DB, itemID int64, received bool) error {
	v := 0
	if received {
		v = 1
	}
	_, err := db.Exec("UPDATE items SET is_received = ? WHERE id = ?", v, itemID)
	return err
}

func SetItemArchived(db *sql.DB, itemID int64, archived bool) error {
	v := 0
	if archived {
		v = 1
	}
	_, err := db.Exec("UPDATE items SET is_archived = ? WHERE id = ?", v, itemID)
	return err
}

func ReorderItems(db *sql.DB, userID int64, ids []int64) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	// Limit every update by user_id so a bad client cannot reorder someone else's
	// items by sending their ids.
	for i, id := range ids {
		if _, err := tx.Exec("UPDATE items SET sort_order = ? WHERE id = ? AND user_id = ?", i, id, userID); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func CreateSignupToken(db *sql.DB, id string, expiresAt time.Time) error {
	_, err := db.Exec(
		"INSERT INTO signup_tokens (id, expires_at) VALUES (?, ?)",
		id, expiresAt.UTC().Format(time.RFC3339),
	)
	return err
}

func GetSignupToken(db *sql.DB, id string) (*models.SignupToken, error) {
	var t models.SignupToken
	var expiresAt string
	var used int
	err := db.QueryRow("SELECT id, expires_at, used FROM signup_tokens WHERE id = ?", id).
		Scan(&t.ID, &expiresAt, &used)
	if err != nil {
		return nil, err
	}
	t.ExpiresAt, err = time.Parse(time.RFC3339, expiresAt)
	if err != nil {
		return nil, err
	}
	t.Used = used == 1
	return &t, nil
}

func UseSignupToken(db *sql.DB, id string) error {
	_, err := db.Exec("UPDATE signup_tokens SET used = 1 WHERE id = ?", id)
	return err
}

func getItemByID(db *sql.DB, id int64) (*models.Item, error) {
	return scanItem(db.QueryRow(itemSelect+" WHERE i.id = ?", id))
}
