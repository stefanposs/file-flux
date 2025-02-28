package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
	"github.com/stefanposs/file-flux/client/internal/api"
	"github.com/stefanposs/file-flux/client/pkg/config"
)

func startJobWatcher(job config.ClientJob, client *api.ApiClient) {
	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("[%s] Error creating file watcher: %v", job.JobID, err)
		return
	}
	defer watcher.Close()

	// Add the job-specific upload directory to the watcher.
	err = watcher.Add(job.UploadDir)
	if err != nil {
		log.Printf("[%s] Error adding directory to watcher: %v", job.JobID, err)
		return
	}

	log.Printf("[%s] Watching directory: %s", job.JobID, job.UploadDir)

	for {
		select {
		case event, ok := <-watcher.Events:
			if !ok {
				return
			}
			if event.Op&fsnotify.Create == fsnotify.Create {
				filePath := event.Name
				log.Printf("[%s] New file detected: %s", job.JobID, filePath)

				// Upload the file (Job-ID und Upload-Token werden übergeben)
				if err := client.LongPollingUploadFile(filePath, job.JobID, job.UploadToken); err != nil {
					log.Printf("[%s] Error uploading file: %v", job.JobID, err)
					continue
				}
				log.Printf("[%s] File uploaded successfully: %s", job.JobID, filePath)

				// Download the file (Job-ID und Download-Token werden übergeben)
				fileName := filepath.Base(filePath)
				if err := client.LongPollingDownloadFile(fileName, job.DownloadDir, job.JobID, job.DownloadToken); err != nil {
					log.Printf("[%s] Error downloading file: %v", job.JobID, err)
					continue
				}
				log.Printf("[%s] File downloaded successfully: %s", job.JobID, fileName)

				// Lösche die hochgeladene Datei
				if err := os.Remove(filePath); err != nil {
					log.Printf("[%s] Error deleting file: %v", job.JobID, err)
				} else {
					log.Printf("[%s] File deleted successfully: %s", job.JobID, filePath)
				}
			}
		case err, ok := <-watcher.Errors:
			if !ok {
				return
			}
			log.Printf("[%s] Error watching files: %v", job.JobID, err)
		}
	}
}

func main() {
	// Konfiguration laden (enthält nun mehrere Jobs)
	configPath := "pkg/config/config.yml"
	cfg, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Could not load config: %v", err)
	}

	// API-Client initialisieren
	client := api.NewApiClient(cfg.ServerURL)

	// Für jeden definierten Job einen separaten Watcher starten
	for _, job := range cfg.Jobs {
		go startJobWatcher(job, client)
		log.Printf("Started watcher for JobID: %s", job.JobID)
	}

	// Blockiere main(), damit die Goroutinen weiterlaufen
	select {}
}
