package api

import (
	"log"
	"net/http"

	"github.com/stefanposs/file-flux/backend/internal/db"
	"github.com/stefanposs/file-flux/backend/internal/handlers"
	"github.com/stefanposs/file-flux/backend/internal/middleware"
	"github.com/stefanposs/file-flux/backend/internal/websocket"

	"github.com/gorilla/mux"
)

// NewRouter erstellt einen neuen Router mit allen API-Endpunkten
func NewRouter(db *db.Database, wsManager *websocket.Manager, logger *log.Logger) http.Handler {
	router := mux.NewRouter()

	// Middleware registrieren
	router.Use(middleware.Logger(logger))
	router.Use(middleware.Recover(logger))
	router.Use(middleware.CORS)

	// API-Handler erstellen
	authHandler := handlers.NewAuthHandler(db, logger)
	agentHandler := handlers.NewAgentHandler(db, wsManager, logger)
	jobHandler := handlers.NewJobHandler(db, logger)
	transferHandler := handlers.NewTransferHandler(db, logger)
	tokenHandler := handlers.NewTokenHandler(db, logger)

	// API-Routen registrieren
	api := router.PathPrefix("/api").Subrouter()

	// Authentifizierungsrouten
	auth := api.PathPrefix("/auth").Subrouter()
	auth.HandleFunc("/login", authHandler.Login).Methods("POST")
	auth.HandleFunc("/refresh", authHandler.RefreshToken).Methods("POST")
	auth.Handle("/user", middleware.Auth(http.HandlerFunc(authHandler.GetCurrentUser))).Methods("GET")

	// Agenten-Routen
	agents := api.PathPrefix("/agents").Subrouter()
	agents.Handle("", middleware.Auth(http.HandlerFunc(agentHandler.GetAgents))).Methods("GET")
	agents.Handle("", middleware.Auth(http.HandlerFunc(agentHandler.CreateAgent))).Methods("POST")
	agents.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agentHandler.GetAgent))).Methods("GET")
	agents.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agentHandler.UpdateAgent))).Methods("PUT")
	agents.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agentHandler.DeleteAgent))).Methods("DELETE")
	agents.Handle("/{id:[0-9]+}/test", middleware.Auth(http.HandlerFunc(agentHandler.TestConnection))).Methods("POST")

	// Job-Routen
	jobs := api.PathPrefix("/jobs").Subrouter()
	jobs.Handle("", middleware.Auth(http.HandlerFunc(jobHandler.GetJobs))).Methods("GET")
	jobs.Handle("", middleware.Auth(http.HandlerFunc(jobHandler.CreateJob))).Methods("POST")
	jobs.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobHandler.GetJob))).Methods("GET")
	jobs.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobHandler.UpdateJob))).Methods("PUT")
	jobs.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobHandler.DeleteJob))).Methods("DELETE")
	jobs.Handle("/{id:[0-9]+}/run", middleware.Auth(http.HandlerFunc(jobHandler.RunJob))).Methods("POST")

	// Transfer-Routen
	transfers := api.PathPrefix("/transfers").Subrouter()
	transfers.Handle("", middleware.Auth(http.HandlerFunc(transferHandler.GetTransfers))).Methods("GET")
	transfers.Handle("", middleware.Auth(http.HandlerFunc(transferHandler.CreateTransfer))).Methods("POST")
	transfers.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(transferHandler.GetTransfer))).Methods("GET")
	transfers.Handle("/{id:[0-9]+}/cancel", middleware.Auth(http.HandlerFunc(transferHandler.CancelTransfer))).Methods("POST")

	// Token-Routen
	tokens := api.PathPrefix("/tokens").Subrouter()
	tokens.Handle("", middleware.Auth(http.HandlerFunc(tokenHandler.GetTokens))).Methods("GET")
	tokens.Handle("", middleware.Auth(http.HandlerFunc(tokenHandler.CreateToken))).Methods("POST")
	tokens.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(tokenHandler.RevokeToken))).Methods("DELETE")

	// Health Check
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET", "HEAD")

	// Statische Dateien für das Frontend
	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	return router
}
