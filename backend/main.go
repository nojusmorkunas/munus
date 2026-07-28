package main

import (
	"io/fs"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	appdb "github.com/nojusmorkunas/munus/db"
	"github.com/nojusmorkunas/munus/handlers"
)

func main() {
	port := getEnv("PORT", "3967")
	dbPath := getEnv("DATABASE_PATH", "./munus.db")
	uploadsPath := getEnv("UPLOADS_PATH", "./uploads")
	adminUsername := getEnv("ADMIN_USERNAME", "admin")
	adminPassword := os.Getenv("ADMIN_PASSWORD")
	adminDisplayName := getEnv("ADMIN_DISPLAY_NAME", "Admin")
	appEnv := getEnv("APP_ENV", "development")

	// Local dev may use the fallback password, but a deployed app should fail fast.
	if adminPassword == "" {
		if appEnv != "development" {
			log.Fatal("ADMIN_PASSWORD is required when APP_ENV is not development")
		}
		adminPassword = "changeme"
		log.Print("warning: using default development admin password; set ADMIN_PASSWORD before exposing this app")
	}
	if adminPassword == "changeme" && appEnv != "development" {
		log.Fatal("ADMIN_PASSWORD must not be changeme outside development")
	}

	handlers.SetUploadsDir(uploadsPath)

	db, err := appdb.Init(dbPath)
	if err != nil {
		log.Fatalf("failed to init db: %v", err)
	}
	if err := appdb.SeedAdmin(db, adminUsername, adminPassword, adminDisplayName); err != nil {
		log.Fatalf("failed to seed admin: %v", err)
	}
	appdb.SeedSettings(db)
	appdb.EnsurePublicTokens(db)
	handlers.StartAvailabilityTracker(db, getDurationEnv("AVAILABILITY_CHECK_INTERVAL", 12*time.Hour))

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(corsMiddleware)

	r.Route("/api", func(r chi.Router) {
		r.Use(jsonContentType)

		// Public and auth routes do not need an existing session.
		r.Get("/public/{token}", handlers.GetPublicList(db))
		r.Post("/auth/login", handlers.Login(db))
		r.Post("/auth/logout", handlers.Logout(db))
		r.With(handlers.RequireAuth(db)).Get("/auth/me", handlers.Me(db))
		r.Get("/auth/signup/{token}", handlers.ValidateSignupToken(db))
		r.Post("/auth/signup/{token}", handlers.Signup(db))

		r.Group(func(r chi.Router) {
			// Everything in here is for logged-in users.
			r.Use(handlers.RequireAuth(db))
			r.Get("/settings", handlers.GetSettings(db))
			r.Get("/users", handlers.GetUsers(db))
			r.Get("/users/{id}", handlers.GetUser(db))
			r.Get("/items/mine", handlers.GetMyItems(db))
			r.Get("/items/user/{userId}", handlers.GetUserItems(db))
			r.Post("/items", handlers.CreateItem(db))
			// reorder must come before /{id} so "reorder" isn't treated as an id
			r.Put("/items/reorder", handlers.ReorderItems(db))
			r.Put("/items/{id}", handlers.UpdateItem(db))
			r.Delete("/items/{id}", handlers.DeleteItem(db))
			r.Post("/items/{id}/claim", handlers.ClaimItem(db))
			r.Put("/items/{id}/claim", handlers.UpdateClaimNote(db))
			r.Delete("/items/{id}/claim", handlers.UnclaimItem(db))
			r.Post("/items/{id}/purchase", handlers.PurchaseItem(db))
			r.Delete("/items/{id}/purchase", handlers.UnpurchaseItem(db))
			r.Post("/items/{id}/received", handlers.ReceivedItem(db))
			r.Delete("/items/{id}/received", handlers.UnreceivedItem(db))
			r.Post("/items/{id}/archive", handlers.ArchiveItem(db))
			r.Delete("/items/{id}/archive", handlers.UnarchiveItem(db))
			r.Put("/profile", handlers.UpdateProfile(db))
			r.Put("/profile/password", handlers.UpdateProfilePassword(db))
			r.Get("/scrape", handlers.ScrapeURL())
			r.Post("/upload", handlers.UploadImage())
		})

		r.Group(func(r chi.Router) {
			// Admin-only actions: user management and global settings.
			r.Use(handlers.RequireAdmin(db))
			r.Post("/admin/users", handlers.AdminCreateUser(db))
			r.Delete("/admin/users/{id}", handlers.AdminDeleteUser(db))
			r.Put("/admin/users/{id}/password", handlers.AdminUpdatePassword(db))
			r.Post("/admin/signup-links", handlers.AdminCreateSignupLink(db))
			r.Put("/admin/settings", handlers.UpdateSettings(db))
		})
	})

	r.Get("/uploads/*", http.StripPrefix("/uploads/", http.FileServer(http.Dir(uploadsPath))).ServeHTTP)
	// Anything that is not an API/upload file is handled by the React app.
	r.Get("/*", spaHandler())

	log.Printf("listening on :%s", port)
	if err := http.ListenAndServe(":"+port, r); err != nil {
		log.Fatal(err)
	}
}

func spaHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		fsys := os.DirFS("./frontend/dist")
		path := strings.TrimPrefix(r.URL.Path, "/")
		if path != "" {
			if _, err := fs.Stat(fsys, path); err == nil {
				http.FileServerFS(fsys).ServeHTTP(w, r)
				return
			}
		}
		http.ServeFileFS(w, r, fsys, "index.html")
	}
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", r.Header.Get("Origin"))
		w.Header().Set("Access-Control-Allow-Credentials", "true")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func jsonContentType(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		next.ServeHTTP(w, r)
	})
}

func getEnv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func getDurationEnv(key string, fallback time.Duration) time.Duration {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	duration, err := time.ParseDuration(value)
	if err != nil {
		log.Printf("warning: invalid %s %q; using %s", key, value, fallback)
		return fallback
	}
	return duration
}
