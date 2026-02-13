package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/stefanposs/file-flux/agent/internal/api"
	"github.com/stefanposs/file-flux/agent/internal/config"
	"github.com/stefanposs/file-flux/agent/internal/system"
	"github.com/stefanposs/file-flux/agent/internal/transfer"
	"github.com/stefanposs/file-flux/agent/internal/websocket"
)

func main() {
	// Kommandozeilenargumente
	configFile := flag.String("config", "config.yaml", "Pfad zur Konfigurationsdatei")
	version := flag.Bool("version", false, "Version anzeigen")
	flag.Parse()

	// Version anzeigen und beenden, wenn angefordert
	if *version {
		log.Println("FileFlux Agent v1.0.0")
		os.Exit(0)
	}

	// Konfiguration laden
	cfg, err := config.LoadConfig(*configFile)
	if err != nil {
		log.Fatalf("Fehler beim Laden der Konfiguration: %v", err)
	}

	// Logger einrichten
	logger := log.New(os.Stdout, "AGENT: ", log.LstdFlags|log.Lshortfile)
	logger.Println("FileFlux Agent wird gestartet...")

	// Systeminformationen sammeln
	sysInfo := system.CollectSystemInfo()
	logger.Printf("System: %s", sysInfo.OSName)
	logger.Printf("Hostname: %s", sysInfo.Hostname)
	logger.Printf("IP-Adresse: %s", sysInfo.IPAddress)

	// Transfer-Manager erstellen
	apiClient := api.NewClient(cfg.Connection.ServerHTTPURL, cfg.Connection.Token)
	transferManager := transfer.NewManager(logger, cfg.Transfers, apiClient)

	// WebSocket-Client erstellen
	wsClient := websocket.NewClient(cfg.Connection, logger)
	wsClient.SetSystemInfo(sysInfo)
	wsClient.SetTransferManager(transferManager)

	// WebSocket-Client als Progress-Reporter setzen
	transferManager.SetReporter(wsClient)

	// Verbindung zum Server herstellen
	go func() {
		if err := wsClient.Connect(); err != nil {
			logger.Fatalf("Fehler beim Herstellen der WebSocket-Verbindung: %v", err)
		}
	}()

	// Warten auf Beendigungssignal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Aufräumen
	logger.Println("Agent wird beendet...")
	wsClient.Disconnect()
	transferManager.StopAll()
	logger.Println("Agent erfolgreich beendet.")
}
