package main

import (
	"fmt"
	"log"

	"github.com/stefanposs/file-flux/client/pkg/config"

	"github.com/stefanposs/file-flux/client/internal/api"
)

func main() {
	// Load configuration
	cfg, err := config.LoadConfig("config.yml")
	if err != nil {
		log.Fatalf("Could not load config: %v", err)
	}

	// Initialize the API client
	client := api.NewApiClient(cfg.ServerURL)

	// Example usage: Upload a file
	err = client.LongPollingUploadFile(cfg.UploadDir + "/file.txt")
	if err != nil {
		log.Fatalf("Error uploading file: %v", err)
	}
	fmt.Println("File uploaded successfully.")

	// Example usage: Download a file
	err = client.LongPollingDownloadFile("file-id", cfg.DownloadDir)
	if err != nil {
		log.Fatalf("Error downloading file: %v", err)
	}
	fmt.Println("File downloaded successfully.")
}
