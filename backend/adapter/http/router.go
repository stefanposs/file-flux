package http

import (
	"log"
	"net/http"

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
}

// NewRouter erstellt einen neuen HTTP-Router mit allen Endpunkten.
func NewRouter(deps RouterDeps) http.Handler {
	router := mux.NewRouter()

	router.Use(middleware.Logger(deps.Logger))
	router.Use(middleware.Recover(deps.Logger))
	router.Use(middleware.CORS)

	auth := NewAuthHandler(deps.AuthService)
	agents := NewAgentHandler(deps.AgentService)
	jobs := NewJobHandler(deps.JobService)
	transfers := NewTransferHandler(deps.TransferService)
	tokens := NewTokenHandler(deps.TokenService)

	api := router.PathPrefix("/api").Subrouter()

	authRoutes := api.PathPrefix("/auth").Subrouter()
	authRoutes.HandleFunc("/login", auth.Login).Methods("POST")
	authRoutes.Handle("/refresh", middleware.Auth(http.HandlerFunc(auth.RefreshToken))).Methods("POST")
	authRoutes.Handle("/user", middleware.Auth(http.HandlerFunc(auth.GetCurrentUser))).Methods("GET")

	agentRoutes := api.PathPrefix("/agents").Subrouter()
	agentRoutes.Handle("", middleware.Auth(http.HandlerFunc(agents.GetAgents))).Methods("GET")
	agentRoutes.Handle("", middleware.Auth(http.HandlerFunc(agents.CreateAgent))).Methods("POST")
	agentRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agents.GetAgent))).Methods("GET")
	agentRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agents.UpdateAgent))).Methods("PUT")
	agentRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(agents.DeleteAgent))).Methods("DELETE")
	agentRoutes.Handle("/{id:[0-9]+}/test", middleware.Auth(http.HandlerFunc(agents.TestConnection))).Methods("POST")

	jobRoutes := api.PathPrefix("/jobs").Subrouter()
	jobRoutes.Handle("", middleware.Auth(http.HandlerFunc(jobs.GetJobs))).Methods("GET")
	jobRoutes.Handle("", middleware.Auth(http.HandlerFunc(jobs.CreateJob))).Methods("POST")
	jobRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobs.GetJob))).Methods("GET")
	jobRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobs.UpdateJob))).Methods("PUT")
	jobRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(jobs.DeleteJob))).Methods("DELETE")
	jobRoutes.Handle("/{id:[0-9]+}/run", middleware.Auth(http.HandlerFunc(jobs.RunJob))).Methods("POST")

	transferRoutes := api.PathPrefix("/transfers").Subrouter()
	transferRoutes.Handle("", middleware.Auth(http.HandlerFunc(transfers.GetTransfers))).Methods("GET")
	transferRoutes.Handle("", middleware.Auth(http.HandlerFunc(transfers.CreateTransfer))).Methods("POST")
	transferRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(transfers.GetTransfer))).Methods("GET")
	transferRoutes.Handle("/{id:[0-9]+}/cancel", middleware.Auth(http.HandlerFunc(transfers.CancelTransfer))).Methods("POST")

	tokenRoutes := api.PathPrefix("/tokens").Subrouter()
	tokenRoutes.Handle("", middleware.Auth(http.HandlerFunc(tokens.GetTokens))).Methods("GET")
	tokenRoutes.Handle("", middleware.Auth(http.HandlerFunc(tokens.CreateToken))).Methods("POST")
	tokenRoutes.Handle("/{id:[0-9]+}", middleware.Auth(http.HandlerFunc(tokens.RevokeToken))).Methods("DELETE")

	// Health Check (outside /api prefix, used by Docker healthcheck)
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok"}`))
	}).Methods("GET", "HEAD")

	router.PathPrefix("/").Handler(http.FileServer(http.Dir("./static")))

	return router
}
