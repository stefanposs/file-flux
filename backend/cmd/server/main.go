package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/stefanposs/file-flux/backend/pkg/api"
	"github.com/stefanposs/file-flux/backend/pkg/config"
	"github.com/stefanposs/file-flux/backend/pkg/infrastructure/db"
	"github.com/stefanposs/file-flux/backend/pkg/infrastructure/logger"
	"go.uber.org/zap"
)

func main() {
	// Logger initialisieren
	l, err := logger.NewLogger(config.GetEnv("ENV", "development"))
	if err != nil {
		log.Fatalf("Fehler beim Initialisieren des Loggers: %v", err)
	}
	defer l.Sync()

	// Konfiguration laden
	cfg := config.LoadConfig()
	l.Info("Konfiguration geladen", zap.String("port", cfg.ServerPort))

	// Datenbankverbindung herstellen
	database, err := db.NewPostgresDB(cfg.DatabaseURL)
	if err != nil {
		l.Fatal("Fehler beim Verbinden mit der Datenbank", zap.Error(err))
	}
	l.Info("Datenbankverbindung hergestellt")

	// API-Server initialisieren
	server := api.NewServer(cfg, l, database)

	// Server starten
	go func() {
		if err := server.Start(); err != nil && err != http.ErrServerClosed {
			l.Fatal("Fehler beim Starten des Servers", zap.Error(err))
		}
	}()
	l.Info("Server gestartet", zap.String("address", "http://localhost:"+cfg.ServerPort))

	// Graceful Shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	l.Info("Server wird heruntergefahren...")
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		l.Fatal("Server konnte nicht ordnungsgemäß heruntergefahren werden", zap.Error(err))
	}

	l.Info("Server wurde ordnungsgemäß heruntergefahren")
}
