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
	"github.com/stefanposs/file-flux/agent/internal/transport"
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

	// Transport erstellen (Auto: WebSocket mit Polling-Fallback)
	sysInfoTransport := &transport.SystemInfo{
		Hostname:   sysInfo.Hostname,
		OSName:     sysInfo.OSName,
		OSVersion:  sysInfo.OSVersion,
		IPAddress:  sysInfo.IPAddress,
		NumCPU:     sysInfo.NumCPUs,
		TotalMemMB: sysInfo.TotalMemMB,
		GoVersion:  sysInfo.GoVersion,
		Version:    "1.0.0",
	}

	autoTransport := transport.NewAutoTransport(transport.AutoConfig{
		TransportMode: cfg.Connection.TransportMode,
		WS: transport.WSConfig{
			ServerURL:         cfg.Connection.ServerURL,
			Token:             cfg.Connection.Token,
			HeartbeatInterval: cfg.Connection.HeartbeatInterval,
			ReconnectDelay:    cfg.Connection.ReconnectDelay,
		},
		Polling: transport.PollingConfig{
			ServerHTTPURL:  cfg.Connection.ServerHTTPURL,
			Token:          cfg.Connection.Token,
			PollTimeout:    cfg.Connection.PollTimeout,
			ReconnectDelay: cfg.Connection.ReconnectDelay,
		},
		WSProbeInterval: cfg.Connection.WSProbeInterval,
	}, logger, sysInfoTransport)

	autoTransport.SetTransferHandler(transferManager)

	// AutoTransport als Progress-Reporter setzen
	transferManager.SetReporter(autoTransport)

	// Verbindung zum Server herstellen (Auto: WS mit Polling-Fallback)
	go func() {
		if err := autoTransport.Connect(); err != nil {
			logger.Printf("Transport-Verbindung beendet: %v", err)
		}
	}()

	// Warten auf Beendigungssignal
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	// Aufräumen
	logger.Println("Agent wird beendet...")
	autoTransport.Disconnect()
	transferManager.StopAll()
	logger.Println("Agent erfolgreich beendet.")
}
