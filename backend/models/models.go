package models

import "time"

type User struct {
	ID          int64  `json:"id"`
	Username    string `json:"username"`
	DisplayName string `json:"displayName"`
	Birthday    string `json:"birthday"`
	IsAdmin     bool   `json:"isAdmin"`
	Currency    string `json:"currency"`
	Locale      string `json:"locale"`
	AvatarURL   string `json:"avatarUrl"`
	PublicToken string `json:"publicToken,omitempty"`
}

type Session struct {
	ID        string
	UserID    int64
	ExpiresAt time.Time
}

type SignupToken struct {
	ID        string
	ExpiresAt time.Time
	Used      bool
}

type Item struct {
	ID                    int64  `json:"id"`
	UserID                int64  `json:"userId"`
	Name                  string `json:"name"`
	Description           string `json:"description"`
	URL                   string `json:"url"`
	Price                 string `json:"price"`
	Currency              string `json:"currency"`
	ImageURL              string `json:"imageUrl"`
	Priority              int    `json:"priority"`
	ClaimNote             string `json:"claimNote"`
	IsPurchased           bool   `json:"isPurchased"`
	IsReceived            bool   `json:"isReceived"`
	IsArchived            bool   `json:"isArchived"`
	SortOrder             int    `json:"sortOrder"`
	ClaimedBy             *int64 `json:"claimedBy"`
	ClaimedByName         string `json:"claimedByName"`
	CreatedAt             string `json:"createdAt"`
	AvailabilityStatus    string `json:"availabilityStatus"`
	AvailabilityCheckedAt string `json:"availabilityCheckedAt"`
	Details               string `json:"details"`
	SuggestedBy           *int64 `json:"suggestedBy"`
	SuggestedByName       string `json:"suggestedByName"`
	IsPending             bool   `json:"isPending"`
	SuggestionNote        string `json:"suggestionNote"`
}

type ItemView struct {
	ID                    int64  `json:"id"`
	UserID                int64  `json:"userId"`
	Name                  string `json:"name"`
	Description           string `json:"description"`
	URL                   string `json:"url"`
	Price                 string `json:"price"`
	Currency              string `json:"currency"`
	ImageURL              string `json:"imageUrl"`
	Priority              int    `json:"priority"`
	ClaimNote             string `json:"claimNote"`
	IsPurchased           bool   `json:"isPurchased"`
	IsReceived            bool   `json:"isReceived"`
	IsArchived            bool   `json:"isArchived"`
	SortOrder             int    `json:"sortOrder"`
	Claimed               bool   `json:"claimed"`
	ClaimedByMe           bool   `json:"claimedByMe"`
	ClaimedByName         string `json:"claimedByName"`
	CreatedAt             string `json:"createdAt"`
	AvailabilityStatus    string `json:"availabilityStatus"`
	AvailabilityCheckedAt string `json:"availabilityCheckedAt"`
	// Details holds size, colour or variant choices for whoever buys the gift.
	Details string `json:"details"`
	// IsPending marks a suggestion the list owner has not accepted yet.
	IsPending bool `json:"isPending"`
	// SuggestedByName is only sent to the list owner.
	SuggestedByName string `json:"suggestedByName"`
	SuggestedByMe   bool   `json:"suggestedByMe"`
	SuggestionNote  string `json:"suggestionNote"`
}

type AppSettings struct {
	Currency string `json:"currency"`
	Locale   string `json:"locale"`
}
