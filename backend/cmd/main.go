package main

import (
	"log"
	"net/http"

	"github.com/stefanposs/file-flux/backend/internal/handlers"
	"github.com/stefanposs/file-flux/backend/internal/services"
	"github.com/stefanposs/file-flux/backend/pkg/config"

	"github.com/gorilla/mux"
)

func main() {
	// Load configuration
	cfg := config.LoadConfig()

	// Initialize services
	fileTransferService := services.NewFileTransferService(cfg.FileUploadPath)

	// Initialize handlers
	fileTransferHandler := handlers.NewFileTransferHandler(fileTransferService)

	// Initialize router
	r := mux.NewRouter()

	// Set up routes
	r.HandleFunc("/upload", fileTransferHandler.HandleFileUpload).Methods("POST")
	r.HandleFunc("/download/{id}", fileTransferHandler.HandleFileDownload).Methods("GET")
	r.HandleFunc("/poll/upload", fileTransferHandler.HandleLongPollingUpload).Methods("POST")
	r.HandleFunc("/poll/download/{id}", fileTransferHandler.HandleLongPollingDownload).Methods("GET")

	// Start server
	log.Printf("Starting server on port %s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("Could not start server: %v", err)
	}
}
