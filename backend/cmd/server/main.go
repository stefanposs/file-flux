package main

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	// Application Layer
	agentsvc "github.com/stefanposs/file-flux/backend/application/agent"
	authsvc "github.com/stefanposs/file-flux/backend/application/auth"
	jobsvc "github.com/stefanposs/file-flux/backend/application/job"
	tokensvc "github.com/stefanposs/file-flux/backend/application/token"
	transfersvc "github.com/stefanposs/file-flux/backend/application/transfer"

	// Domain Layer
	transferdomain "github.com/stefanposs/file-flux/backend/domain/transfer"

	// Adapter Layer
	httpadapter "github.com/stefanposs/file-flux/backend/adapter/http"
	jwtadapter "github.com/stefanposs/file-flux/backend/adapter/jwt"
	"github.com/stefanposs/file-flux/backend/adapter/postgres"

	// Internal (wird schrittweise ersetzt)
	"github.com/stefanposs/file-flux/backend/internal/config"
	"github.com/stefanposs/file-flux/backend/internal/middleware"
	"github.com/stefanposs/file-flux/backend/internal/websocket"
)

// transferUpdaterAdapter adapts the transfer repo to the websocket.TransferUpdater interface.
type transferUpdaterAdapter struct {
	repo interface {
		UpdateStatus(ctx context.Context, id int, status transferdomain.Status, errorMsg string) error
	}
}

func (a *transferUpdaterAdapter) UpdateStatus(ctx context.Context, id int, status string, errorMsg string) error {
	return a.repo.UpdateStatus(ctx, id, transferdomain.Status(status), errorMsg)
}

func main() {
	// Logger erstellen
	logger := log.New(os.Stdout, "[fileflux] ", log.LstdFlags|log.Lshortfile)

	// Konfiguration laden
	cfg, err := config.LoadConfig("config.yaml")
	if err != nil {
		logger.Fatalf("Fehler beim Laden der Konfiguration: %v", err)
	}

	// JWT-Secret setzen
	middleware.SetJWTSecret(cfg.Auth.JWTSecret)

	// Konfiguration validieren (warnt bei unsicheren Defaults)
	env := os.Getenv("ENV")
	if env == "" {
		env = "development"
	}
	middleware.ValidateConfig(logger, cfg.Auth.JWTSecret, cfg.Database.Password, env)

	// ─── Infrastructure Layer ───────────────────────────────────────

	// PostgreSQL-Verbindung (Clean Architecture Adapter)
	pgDB, err := postgres.New(postgres.Config{
		Host:     cfg.Database.Host,
		Port:     cfg.Database.Port,
		User:     cfg.Database.User,
		Password: cfg.Database.Password,
		Database: cfg.Database.Database,
		SSLMode:  cfg.Database.SSLMode,
	})
	if err != nil {
		logger.Fatalf("Fehler beim Verbinden mit der Datenbank: %v", err)
	}
	defer pgDB.Close()

	// Schema migrieren
	if err := pgDB.Migrate(); err != nil {
		logger.Printf("Warnung: Schema-Migration: %v", err)
	}

	// ─── Repository Layer (Postgres Adapter) ────────────────────────

	userRepo := postgres.NewUserRepo(pgDB)
	agentRepo := postgres.NewAgentRepo(pgDB)
	jobRepo := postgres.NewJobRepo(pgDB)
	transferRepo := postgres.NewTransferRepo(pgDB)
	tokenRepo := postgres.NewTokenRepo(pgDB)

	// WebSocket-Manager (nutzt jetzt Domain-Repos)
	wsManager := websocket.NewManager(logger, agentRepo, tokenRepo, &transferUpdaterAdapter{repo: transferRepo})

	// ─── Application Layer (Services) ───────────────────────────────

	tokenGen := jwtadapter.New()
	authService := authsvc.NewService(userRepo, tokenGen, cfg.Auth.TokenExpiresIn)
	agentService := agentsvc.NewService(agentRepo, wsManager) // wsManager implementiert ConnectionChecker
	jobService := jobsvc.NewService(jobRepo)
	transferService := transfersvc.NewService(transferRepo)
	tokenService := tokensvc.NewService(tokenRepo)

	// ─── Adapter Layer (HTTP Router) ────────────────────────────────

	router := httpadapter.NewRouter(httpadapter.RouterDeps{
		AuthService:     authService,
		AgentService:    agentService,
		JobService:      jobService,
		TransferService: transferService,
		TokenService:    tokenService,
		Logger:          logger,
		DBPinger:        pgDB,
	})

	// ─── Server starten ─────────────────────────────────────────────

	httpAddr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.Port)
	httpServer := &http.Server{
		Addr:         httpAddr,
		Handler:      router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	wsAddr := fmt.Sprintf("%s:%d", cfg.Server.Host, cfg.Server.WebSocketPort)
	wsServer := &http.Server{
		Addr:    wsAddr,
		Handler: wsManager.Handler(),
	}

	go func() {
		logger.Printf("HTTP-Server gestartet auf %s", httpAddr)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("HTTP-Server Fehler: %v", err)
		}
	}()

	go func() {
		logger.Printf("WebSocket-Server gestartet auf %s", wsAddr)
		if err := wsServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("WebSocket-Server Fehler: %v", err)
		}
	}()

	// ─── Graceful Shutdown ──────────────────────────────────────────

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Println("Server wird heruntergefahren...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := httpServer.Shutdown(ctx); err != nil {
		logger.Printf("HTTP-Server Shutdown Fehler: %v", err)
	}
	if err := wsServer.Shutdown(ctx); err != nil {
		logger.Printf("WebSocket-Server Shutdown Fehler: %v", err)
	}

	logger.Println("Server gestoppt")
}
