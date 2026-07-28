package handlers

import (
	"strings"
	"testing"
)

func TestParseMetaAvailability(t *testing.T) {
	tests := []struct {
		name string
		html string
		want string
	}{
		{
			name: "schema out of stock",
			html: `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","availability":"https://schema.org/OutOfStock"}}</script>`,
			want: availabilityUnavailable,
		},
		{
			name: "schema in stock",
			html: `<script type="application/ld+json">{"@type":"Product","offers":{"@type":"Offer","availability":"https://schema.org/InStock"}}</script>`,
			want: availabilityAvailable,
		},
		{
			name: "mixed variants stay unknown",
			html: `<script type="application/ld+json">{"@type":"Product","offers":[{"@type":"Offer","availability":"InStock"},{"@type":"Offer","availability":"OutOfStock"}]}</script>`,
			want: availabilityUnknown,
		},
		{
			name: "open graph sold out",
			html: `<meta property="product:availability" content="sold out">`,
			want: availabilityUnavailable,
		},
		{
			name: "disabled purchase control",
			html: `<button class="purchase" disabled><span>Sold out</span></button>`,
			want: availabilityUnavailable,
		},
		{
			name: "mixed stock control stays unknown",
			html: `<div class="stock-status"><span>In stock</span><span>Out of stock</span></div>`,
			want: availabilityUnknown,
		},
		{
			name: "unrelated text is ignored",
			html: `<article>Last year's model sold out immediately.</article>`,
			want: availabilityUnknown,
		},
		{
			name: "availability outside product JSON is ignored",
			html: `<script type="application/ld+json">{"@type":"WebSite","availability":"OutOfStock"}</script>`,
			want: availabilityUnknown,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseMeta(strings.NewReader(tt.html)).AvailabilityStatus
			if got != tt.want {
				t.Fatalf("availability = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestBotPageTitles(t *testing.T) {
	for _, title := range []string{"Just a moment...", "Please verify you are human", "403 Forbidden"} {
		if !isBotPage(title) {
			t.Errorf("expected %q to be recognized as a bot/error page", title)
		}
	}
	if isBotPage("A perfectly ordinary product") {
		t.Error("ordinary product title was recognized as a bot page")
	}
}
