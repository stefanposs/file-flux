package http

import (
	"log"
	"net/http"
	"time"

	agentsvc "github.com/stefanposs/file-flux/backend/application/agent"
	authsvc "github.com/stefanposs/file-flux/backend/application/auth"
	jobsvc "github.com/stefanposs/file-flux/backend/application/job"
	tokensvc "github.com/stefanposs/file-flux/backend/application/token"
	transfersvc "github.com/stefanposs/file-flux/backend/application/transfer"
	"github.com/stefanposs/file-flux/backend/internal/middleware"

	"github.com/gorilla/mux"
)

// RouterDeps enthaelt alle Abhaengigkeiten fuer den Router.
type RouterDeps struct {
	AuthService     *authsvc.Service
	AgentService    *agentsvc.Service
	JobService      *jobsvc.Service
	TransferService *transfersvc.Service
	TokenService    *tokensvc.Service
	Logger          *log.Logger
	DBPinger        DBPinger // fuer Deep Health Check
}

// DBPinger interface fuer Health Checks.
type DBPinger interface {
	Ping() error
}

// NewRouter erstellt einen neuen HTTP-Router mit allen Endpunkten.
func NewRouter(deps RouterDeps) http.Handler {
	router := mux.NewRouter()

	// ── Global Middleware Stack (Reihenfolge wichtig) ──
	router.Use(middleware.RequestID)
	router.Use(middleware.Logger(deps.Logger))
	router.Use(middleware.Recover(deps.Logger))
	router.Use(middleware.CORS)

	// ── Rate Limiter ──
	apiLimiter := middleware.NewRateLimiter(100, 1*time.Minute)  // 100 req/min allgemein
	loginLimiter := middleware.NewRateLimiter(10, 1*time.Minute) // 10 login-Versuche/min

	auth := NewAuthHandler(deps.AuthService)
	agents := NewAgentHandler(deps.AgentService)
	jobs := NewJobHandler(deps.JobService)
	transfers := NewTransferHandler(deps.TransferService)
	tokens := NewTokenHandler(deps.TokenService)

	api := router.PathPrefix("/api").Subrouter()
	api.Use(apiLimiter.Limit)

	// ── Auth Routes (offen, mit strengem Rate Limit) ──
	authRoutes := api.PathPrefix("/auth").Subrouter()
	authRoutes.Handle("/login", loginLimiter.Limit(http.HandlerFunc(auth.Login))).Methods("POST")
	authRoutes.Handle("/refresh", middleware.Auth(http.HandlerFunc(auth.RefreshToken))).Methods("POST")
	authRoutes.Handle("/user", middleware.Auth(http.HandlerFunc(auth.GetCurrentUser))).Methods("GET")

	// ── Agent Routes (Admin-only fuer CUD, lesend fuer alle auth Users) ──
	agentRoutes := api.PathPrefix("/agents").Subrouter()
	agentRoutes.Handle("", middleware.Auth(http.HandlerFunc(agents.GetAgents))).Methods("GET")
	agentRoutes.Handle("", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(agents.CreateAgent)))).Methods("POST")
	agentRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agents.GetAgent))).Methods("GET")
	agentRoutes.Handle("/{id:[0-9]+}", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(agents.UpdateAgent)))).Methods("PUT")
	agentRoutes.Handle("/{id:[0-9]+}", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(agents.DeleteAgent)))).Methods("DELETE")
	agentRoutes.Handle("/{id:[0-9]+}/test", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(agents.TestConnection)))).Methods("POST")

	// ── Job Routes (auth required) ──
	jobRoutes := api.PathPrefix("/jobs").Subrouter()
	jobRoutes.Handle("", middleware.Auth(http.HandlerFunc(jobs.GetJobs))).Methods("GET")
	jobRoutes.Handle("", middleware.Auth(http.HandlerFunc(jobs.CreateJob))).Methods("POST")
	jobRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobs.GetJob))).Methods("GET")
	jobRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobs.UpdateJob))).Methods("PUT")
	jobRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobs.DeleteJob))).Methods("DELETE")
	jobRoutes.Handle("/{id:[0-9]+}/run", middleware.Auth(http.HandlerFunc(jobs.RunJob))).Methods("POST")

	// ── Transfer Routes (auth required) ──
	transferRoutes := api.PathPrefix("/transfers").Subrouter()
	transferRoutes.Handle("", middleware.Auth(http.HandlerFunc(transfers.GetTransfers))).Methods("GET")
	transferRoutes.Handle("", middleware.Auth(http.HandlerFunc(transfers.CreateTransfer))).Methods("POST")
	transferRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(transfers.GetTransfer))).Methods("GET")
	transferRoutes.Handle("/{id:[0-9]+}/cancel", middleware.Auth(http.HandlerFunc(transfers.CancelTransfer))).Methods("POST")

	// ── Token Routes (Admin-only fuer CUD) ──
	tokenRoutes := api.PathPrefix("/tokens").Subrouter()
	tokenRoutes.Handle("", middleware.Auth(http.HandlerFunc(tokens.GetTokens))).Methods("GET")
	tokenRoutes.Handle("", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(tokens.CreateToken)))).Methods("POST")
	tokenRoutes.Handle("/{id:[0-9]+}", middleware.Auth(middleware.AdminOnly(http.HandlerFunc(tokens.RevokeToken)))).Methods("DELETE")

	// ── Health Check (Deep — prüft DB-Konnektivitaet) ──
	router.HandleFunc("/health", NewHealthHandler(deps.DBPinger)).Methods("GET", "HEAD")

	// ── API Info Endpoint ──
	router.HandleFunc("/api/info", func(w http.ResponseWriter, r *http.Request) {
		respondJSON(w, http.StatusOK, map[string]string{
			"name":    "FileFlux API",
			"version": "1.0.0",
			"docs":    "/api/docs",
		})
	}).Methods("GET")

	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	return router
}

// NewHealthHandler erstellt einen Deep-Health-Check Handler.
func NewHealthHandler(db DBPinger) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		dbStatus := "ok"
		httpStatus := http.StatusOK

		if db != nil {
			if err := db.Ping(); err != nil {
				dbStatus = "error"
				httpStatus = http.StatusServiceUnavailable
			}
		}

		status := "ok"
		if httpStatus != http.StatusOK {
			status = "degraded"
		}

		w.WriteHeader(httpStatus)
		respondJSON(w, httpStatus, map[string]interface{}{
			"status":  status,
			"version": "1.0.0",
			"components": map[string]string{
				"database": dbStatus,
				"api":      "ok",
			},
		})
	}
}
