package main

import (
	"log"
	"net/http"
	"os"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/joho/godotenv"
	"github.com/stack/server/internal/db"
	"github.com/stack/server/internal/handlers"
)

func main() {
	_ = godotenv.Load()

	if err := db.Connect(); err != nil {
		log.Fatalf("database connection failed: %v", err)
	}
	if err := db.Migrate(); err != nil {
		log.Fatalf("migration failed: %v", err)
	}
	log.Println("database ready")

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(corsMiddleware)

	r.Post("/api/infer", handlers.Infer)
	r.Get("/api/health", handlers.Health)

	r.Post("/api/canvases", handlers.CreateCanvas)
	r.Get("/api/canvases", handlers.ListCanvases)
	r.Get("/api/canvases/{id}", handlers.GetCanvas)
	r.Put("/api/canvases/{id}", handlers.SaveCanvas)
	r.Delete("/api/canvases/{id}", handlers.DeleteCanvas)

	r.Post("/api/canvases/{id}/snapshots", handlers.CreateSnapshot)
	r.Get("/api/canvases/{id}/snapshots", handlers.ListSnapshots)

	log.Printf("stack server running on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, r))
}

func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
