package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
	"github.com/stefanposs/file-flux/client/internal/api"
	"github.com/stefanposs/file-flux/client/pkg/config"
)

func main() {
	// Load configuration
	configPath := "pkg/config/config.yml"
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Could not load config: %v", err)
	}

	// Initialize the API client
	client := api.NewApiClient(cfg.ServerURL)

	// Watch the uploads directory for new files
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Fatalf("Error creating file watcher: %v", err)
	}
	defer watcher.Close()

	done := make(chan bool)

	go func() {
		for {
			select {
			case event, ok := <-watcher.Events:
				if !ok {
					return
				}
				if event.Op&fsnotify.Create == fsnotify.Create {
					filePath := event.Name
					log.Printf("New file detected: %s", filePath)

					// Upload the file
					err := client.LongPollingUploadFile(filePath)
					if err != nil {
						log.Printf("Error uploading file: %v", err)
						continue
					}
					log.Printf("File uploaded successfully: %s", filePath)

					// Download the file
					fileName := filepath.Base(filePath)
					err = client.LongPollingDownloadFile(fileName, cfg.DownloadDir)
					if err != nil {
						log.Printf("Error downloading file: %v", err)
						continue
					}
					log.Printf("File downloaded successfully: %s", fileName)

					// Delete the uploaded file
					err = os.Remove(filePath)
					if err != nil {
						log.Printf("Error deleting file: %v", err)
					} else {
						log.Printf("File deleted successfully: %s", filePath)
					}
				}
			case err, ok := <-watcher.Errors:
				if !ok {
					return
				}
				log.Printf("Error watching files: %v", err)
			}
		}
	}()

	err = watcher.Add(cfg.UploadDir)
	if err != nil {
		log.Fatalf("Error adding directory to watcher: %v", err)
	}

	<-done
}
