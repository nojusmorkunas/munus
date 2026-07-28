package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	appdb "github.com/nojusmorkunas/munus/db"
	"golang.org/x/net/html"
)

type ScrapedMeta struct {
	Name                  string `json:"name"`
	Description           string `json:"description"`
	Price                 string `json:"price"`
	Image                 string `json:"image"`
	AvailabilityStatus    string `json:"availabilityStatus"`
	AvailabilityCheckedAt string `json:"availabilityCheckedAt"`
}

const (
	availabilityUnknown     = "unknown"
	availabilityAvailable   = "available"
	availabilityUnavailable = "unavailable"
)

var privateRanges []*net.IPNet

func init() {
	for _, cidr := range []string{
		"127.0.0.0/8",
		"10.0.0.0/8",
		"172.16.0.0/12",
		"192.168.0.0/16",
		"169.254.0.0/16",
		"::1/128",
		"fc00::/7",
		"fe80::/10",
	} {
		_, block, _ := net.ParseCIDR(cidr)
		privateRanges = append(privateRanges, block)
	}
}

func isPrivateIP(ip net.IP) bool {
	for _, block := range privateRanges {
		if block.Contains(ip) {
			return true
		}
	}
	return false
}

func safeDialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return nil, err
	}
	ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
	if err != nil {
		return nil, err
	}
	for _, ipa := range ips {
		if isPrivateIP(ipa.IP) {
			return nil, fmt.Errorf("address %s resolves to a private IP", host)
		}
	}
	if len(ips) == 0 {
		return nil, fmt.Errorf("address %s did not resolve", host)
	}
	return (&net.Dialer{}).DialContext(ctx, network, net.JoinHostPort(ips[0].IP.String(), port))
}

var scrapeClient = &http.Client{
	Timeout: 8 * time.Second,
	Transport: &http.Transport{
		DialContext: safeDialContext,
	},
}

var (
	scrapeMu      sync.Mutex
	scrapeWindows = map[string][2]int64{} // ip -> [windowStart, count]
	recentScrapes = map[string]ScrapedMeta{}
)

func scrapeAllowed(r *http.Request) bool {
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	now := time.Now().Unix()
	scrapeMu.Lock()
	defer scrapeMu.Unlock()
	e := scrapeWindows[ip]
	if now-e[0] >= 60 {
		scrapeWindows[ip] = [2]int64{now, 1}
		return true
	}
	if e[1] >= 10 {
		return false
	}
	scrapeWindows[ip] = [2]int64{e[0], e[1] + 1}
	return true
}

func ScrapeURL() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !scrapeAllowed(r) {
			writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "too many requests"})
			return
		}
		meta, err := fetchProductMeta(r.Context(), r.URL.Query().Get("url"))
		if err == errInvalidProductURL {
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid url"})
			return
		}
		if err != nil {
			writeJSON(w, http.StatusBadGateway, map[string]string{"error": "could not fetch url"})
			return
		}
		rememberScrape(r.URL.Query().Get("url"), meta)
		writeJSON(w, http.StatusOK, meta)
	}
}

func rememberScrape(rawURL string, meta ScrapedMeta) {
	scrapeMu.Lock()
	defer scrapeMu.Unlock()
	if len(recentScrapes) >= 250 {
		cutoff := time.Now().Add(-15 * time.Minute)
		for key, cached := range recentScrapes {
			checkedAt, err := time.Parse(time.RFC3339, cached.AvailabilityCheckedAt)
			if err != nil || checkedAt.Before(cutoff) {
				delete(recentScrapes, key)
			}
		}
		if len(recentScrapes) >= 250 {
			for key := range recentScrapes {
				delete(recentScrapes, key)
				break
			}
		}
	}
	recentScrapes[rawURL] = meta
}

func recentScrapeAvailability(rawURL string) (string, time.Time, bool) {
	scrapeMu.Lock()
	defer scrapeMu.Unlock()
	meta, ok := recentScrapes[rawURL]
	if !ok {
		return "", time.Time{}, false
	}
	checkedAt, err := time.Parse(time.RFC3339, meta.AvailabilityCheckedAt)
	if err != nil || time.Since(checkedAt) > 15*time.Minute {
		delete(recentScrapes, rawURL)
		return "", time.Time{}, false
	}
	return meta.AvailabilityStatus, checkedAt, true
}

var errInvalidProductURL = fmt.Errorf("invalid product url")

func fetchProductMeta(ctx context.Context, rawURL string) (ScrapedMeta, error) {
	parsed, err := url.ParseRequestURI(rawURL)
	if err != nil || parsed.Hostname() == "" || parsed.User != nil || (!strings.EqualFold(parsed.Scheme, "http") && !strings.EqualFold(parsed.Scheme, "https")) {
		return ScrapedMeta{}, errInvalidProductURL
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, parsed.String(), nil)
	if err != nil {
		return ScrapedMeta{}, errInvalidProductURL
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")

	checkedAt := time.Now().UTC().Format(time.RFC3339)
	resp, err := scrapeClient.Do(req)
	if err != nil {
		return ScrapedMeta{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return ScrapedMeta{AvailabilityStatus: availabilityUnavailable, AvailabilityCheckedAt: checkedAt}, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return ScrapedMeta{AvailabilityStatus: availabilityUnknown, AvailabilityCheckedAt: checkedAt}, nil
	}

	meta := parseMeta(io.LimitReader(resp.Body, 2*1024*1024))
	meta.AvailabilityCheckedAt = checkedAt
	if isBotPage(meta.Name) {
		return ScrapedMeta{AvailabilityStatus: availabilityUnknown, AvailabilityCheckedAt: checkedAt}, nil
	}
	return meta, nil
}

func parseMeta(r io.Reader) ScrapedMeta {
	meta := ScrapedMeta{AvailabilityStatus: availabilityUnknown}
	var titleText string
	inTitle := false
	var scriptJSON strings.Builder
	inJSONLD := false
	var stockText strings.Builder
	stockTextDepth := 0
	availableSignal, unavailableSignal := false, false

	z := html.NewTokenizer(r)
	for {
		tt := z.Next()
		if tt == html.ErrorToken {
			break
		}
		switch tt {
		case html.StartTagToken, html.SelfClosingTagToken:
			t := z.Token()
			if stockTextDepth > 0 && tt != html.SelfClosingTagToken && !isVoidElement(t.Data) {
				stockTextDepth++
			}
			switch t.Data {
			case "title":
				inTitle = true
			case "script":
				if strings.EqualFold(attrVal(t.Attr, "type"), "application/ld+json") {
					inJSONLD = true
					scriptJSON.Reset()
				}
			case "meta":
				prop := attrVal(t.Attr, "property")
				name := attrVal(t.Attr, "name")
				content := attrVal(t.Attr, "content")
				switch prop {
				case "og:title", "twitter:title":
					if meta.Name == "" {
						meta.Name = content
					}
				case "og:description", "twitter:description":
					if meta.Description == "" {
						meta.Description = content
					}
				case "og:image", "twitter:image":
					if meta.Image == "" {
						meta.Image = content
					}
				case "og:price:amount", "product:price:amount":
					if meta.Price == "" {
						meta.Price = content
					}
				case "og:price:currency":
					if meta.Price != "" && !strings.Contains(meta.Price, content) {
						meta.Price = content + meta.Price
					}
				}
				switch name {
				case "description":
					if meta.Description == "" {
						meta.Description = content
					}
				case "twitter:title":
					if meta.Name == "" {
						meta.Name = content
					}
				case "twitter:description":
					if meta.Description == "" {
						meta.Description = content
					}
				case "twitter:image", "twitter:image:src":
					if meta.Image == "" {
						meta.Image = content
					}
				}
				key := strings.ToLower(strings.TrimSpace(firstNonEmpty(prop, name, attrVal(t.Attr, "itemprop"))))
				if strings.Contains(key, "availability") {
					addAvailabilitySignal(content, &availableSignal, &unavailableSignal)
				}
			case "link":
				if strings.EqualFold(attrVal(t.Attr, "itemprop"), "availability") {
					addAvailabilitySignal(firstNonEmpty(attrVal(t.Attr, "href"), attrVal(t.Attr, "content")), &availableSignal, &unavailableSignal)
				}
			}
			if strings.EqualFold(attrVal(t.Attr, "itemprop"), "availability") {
				addAvailabilitySignal(firstNonEmpty(attrVal(t.Attr, "content"), attrVal(t.Attr, "href")), &availableSignal, &unavailableSignal)
			}
			if stockTextDepth == 0 && isStockIndicatorElement(t) {
				stockTextDepth = 1
				stockText.Reset()
			}
		case html.TextToken:
			if inTitle && titleText == "" {
				titleText = strings.TrimSpace(string(z.Text()))
			}
			if inJSONLD {
				scriptJSON.Write(z.Text())
			}
			if stockTextDepth > 0 {
				stockText.Write(z.Text())
				stockText.WriteByte(' ')
			}
		case html.EndTagToken:
			t := z.Token()
			if t.Data == "title" {
				inTitle = false
			}
			if t.Data == "script" && inJSONLD {
				addJSONLDAvailability(scriptJSON.String(), &availableSignal, &unavailableSignal)
				inJSONLD = false
			}
			if stockTextDepth > 0 {
				stockTextDepth--
				if stockTextDepth == 0 {
					addStockTextSignal(stockText.String(), &availableSignal, &unavailableSignal)
				}
			}
		}
	}
	if meta.Name == "" {
		meta.Name = titleText
	}
	meta.Name = strings.TrimSpace(meta.Name)
	meta.Description = strings.TrimSpace(meta.Description)
	meta.Price = strings.TrimSpace(meta.Price)
	if unavailableSignal != availableSignal {
		if unavailableSignal {
			meta.AvailabilityStatus = availabilityUnavailable
		} else {
			meta.AvailabilityStatus = availabilityAvailable
		}
	}
	return meta
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func addAvailabilitySignal(value string, available, unavailable *bool) {
	normalized := strings.NewReplacer("_", "", "-", "", " ", "").Replace(strings.ToLower(value))
	switch {
	case strings.Contains(normalized, "outofstock"), strings.Contains(normalized, "soldout"),
		strings.Contains(normalized, "discontinued"):
		*unavailable = true
	case strings.Contains(normalized, "instock"), strings.Contains(normalized, "limitedavailability"),
		strings.Contains(normalized, "onlineonly"), strings.Contains(normalized, "preorder"),
		strings.Contains(normalized, "presale"), strings.Contains(normalized, "backorder"):
		*available = true
	}
}

func addJSONLDAvailability(raw string, available, unavailable *bool) {
	var value any
	if json.Unmarshal([]byte(raw), &value) != nil {
		return
	}
	collectProductAvailability(value, false, available, unavailable)
}

func collectProductAvailability(value any, inProduct bool, available, unavailable *bool) {
	switch current := value.(type) {
	case []any:
		for _, child := range current {
			collectProductAvailability(child, inProduct, available, unavailable)
		}
	case map[string]any:
		isProduct := inProduct || schemaTypeIs(current["@type"], "product") || schemaTypeIs(current["@type"], "offer")
		for key, child := range current {
			if isProduct && strings.EqualFold(key, "availability") {
				if text, ok := child.(string); ok {
					addAvailabilitySignal(text, available, unavailable)
				}
				continue
			}
			collectProductAvailability(child, isProduct, available, unavailable)
		}
	}
}

func schemaTypeIs(value any, wanted string) bool {
	switch current := value.(type) {
	case string:
		return schemaTypeName(current) == strings.ToLower(wanted)
	case []any:
		for _, entry := range current {
			if text, ok := entry.(string); ok && schemaTypeName(text) == strings.ToLower(wanted) {
				return true
			}
		}
	}
	return false
}

func schemaTypeName(value string) string {
	value = strings.TrimRight(strings.ToLower(strings.TrimSpace(value)), "/")
	if index := strings.LastIndexAny(value, "/#"); index >= 0 {
		return value[index+1:]
	}
	return value
}

func isStockIndicatorElement(token html.Token) bool {
	if token.Data == "button" && (hasAttr(token.Attr, "disabled") || strings.EqualFold(attrVal(token.Attr, "aria-disabled"), "true")) {
		return true
	}
	marker := strings.ToLower(attrVal(token.Attr, "class") + " " + attrVal(token.Attr, "id"))
	return strings.Contains(marker, "availability") || strings.Contains(marker, "stock-status") ||
		strings.Contains(marker, "out-of-stock") || strings.Contains(marker, "sold-out")
}

func addStockTextSignal(value string, available, unavailable *bool) {
	normalized := strings.ToLower(strings.Join(strings.Fields(value), " "))
	for _, phrase := range []string{
		"out of stock", "sold out", "currently unavailable", "temporarily unavailable",
		"no longer available", "product unavailable", "discontinued",
	} {
		if strings.Contains(normalized, phrase) {
			*unavailable = true
			break
		}
	}
	for _, phrase := range []string{"in stock", "available to order", "ready to ship"} {
		if strings.Contains(normalized, phrase) {
			*available = true
			break
		}
	}
}

func hasAttr(attrs []html.Attribute, key string) bool {
	for _, attr := range attrs {
		if strings.EqualFold(attr.Key, key) {
			return true
		}
	}
	return false
}

func isVoidElement(tag string) bool {
	switch tag {
	case "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr":
		return true
	default:
		return false
	}
}

// StartAvailabilityTracker checks stale saved links in small batches. Unknown
// results are intentional: a blocked or ambiguous page must never be presented
// as proof that the product is unavailable everywhere.
func StartAvailabilityTracker(db *sql.DB, freshness time.Duration) {
	if freshness <= 0 {
		return
	}
	tickEvery := freshness
	if tickEvery > time.Hour {
		tickEvery = time.Hour
	}
	go func() {
		refreshDueAvailability(db, freshness)
		ticker := time.NewTicker(tickEvery)
		defer ticker.Stop()
		for range ticker.C {
			refreshDueAvailability(db, freshness)
		}
	}()
}

func refreshDueAvailability(database *sql.DB, freshness time.Duration) {
	items, err := appdb.GetItemsDueForAvailabilityCheck(database, time.Now().Add(-freshness), 25)
	if err != nil {
		log.Printf("availability tracker: list items: %v", err)
		return
	}
	for _, item := range items {
		meta, fetchErr := fetchProductMeta(context.Background(), item.URL)
		status := meta.AvailabilityStatus
		if status == "" || fetchErr != nil {
			status = availabilityUnknown
		}
		if err := appdb.UpdateItemAvailability(database, item.ID, item.URL, status, time.Now()); err != nil {
			log.Printf("availability tracker: update item %d: %v", item.ID, err)
		}
	}
}

func refreshItemAvailability(database *sql.DB, id int64, rawURL string) {
	if rawURL == "" {
		return
	}
	meta, err := fetchProductMeta(context.Background(), rawURL)
	status := meta.AvailabilityStatus
	if status == "" || err != nil {
		status = availabilityUnknown
	}
	if err := appdb.UpdateItemAvailability(database, id, rawURL, status, time.Now()); err != nil {
		log.Printf("availability tracker: update item %d: %v", id, err)
	}
}

var botPagePatterns = []string{
	"just a moment",
	"are you a robot",
	"robot check",
	"access denied",
	"attention required",
	"security check",
	"checking your browser",
	"please wait",
	"ddos protection",
	"verifying you are human",
	"verify you are human",
	"enable javascript and cookies",
	"before you continue",
	"pardon our interruption",
	"403 forbidden",
	"404 not found",
	"blocked",
	"captcha",
}

func isBotPage(title string) bool {
	lower := strings.ToLower(strings.TrimSpace(title))
	for _, p := range botPagePatterns {
		if strings.Contains(lower, p) {
			return true
		}
	}
	return false
}

func attrVal(attrs []html.Attribute, key string) string {
	for _, a := range attrs {
		if a.Key == key {
			return a.Val
		}
	}
	return ""
}
