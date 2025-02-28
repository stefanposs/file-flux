package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"github.com/stefanposs/file-flux/backend/internal/handlers"
	"github.com/stefanposs/file-flux/backend/internal/services"
	"github.com/stefanposs/file-flux/backend/pkg/config"
)

func main() {
	// Konfiguration laden
	cfg := config.LoadConfig()

	// Service initialisieren (Jobs aus config werden geladen)
	fileTransferService := services.NewFileTransferService(cfg)

	// Handler initialisieren
	fileTransferHandler := handlers.NewFileTransferHandler(fileTransferService)

	// Routen konfigurieren
	r := mux.NewRouter()
	r.HandleFunc("/poll/upload", fileTransferHandler.HandleLongPollingUpload).Methods("POST")
	r.HandleFunc("/poll/download", fileTransferHandler.HandleLongPollingDownload).Methods("GET")

	// Server starten
	log.Printf("Starting server on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("Could not start server: %v", err)
	}
}
