package main

import (
	"log"
	"os"
	"path/filepath"

	"github.com/fsnotify/fsnotify"
	"github.com/stefanposs/file-flux/client/internal/api"
	"github.com/stefanposs/file-flux/client/pkg/config"
)

func processFile(job config.ClientJob, client *api.ApiClient, filePath string) {
	log.Printf("[%s] Processing file: %s", job.JobID, filePath)

	// Upload the file (Job-ID und Upload-Token werden mitgegeben)
	if err := client.LongPollingUploadFile(filePath, job.JobID, job.UploadToken); err != nil {
		log.Printf("[%s] Error uploading file: %v", job.JobID, err)
		return
	}
	log.Printf("[%s] File uploaded successfully: %s", job.JobID, filePath)

	// Datei nach erfolgreichem Upload löschen
	if err := os.Remove(filePath); err != nil {
		log.Printf("[%s] Error deleting file after upload: %v", job.JobID, err)
	} else {
		log.Printf("[%s] File deleted successfully: %s", job.JobID, filePath)
	}

	// Download der Datei (Job-ID und Download-Token werden mitgegeben)
	fileName := filepath.Base(filePath)
	if err := client.LongPollingDownloadFile(fileName, job.DownloadDir, job.JobID, job.DownloadToken); err != nil {
		log.Printf("[%s] Error downloading file: %v", job.JobID, err)
		return
	}
	log.Printf("[%s] File downloaded successfully: %s", job.JobID, fileName)
}

func startJobWatcher(job config.ClientJob, client *api.ApiClient) {
	// Erstelle Upload-Ordner (und ggf. alle Unterordner), falls nicht vorhanden
	if err := os.MkdirAll(job.UploadDir, 0755); err != nil {
		log.Printf("[%s] Error creating upload directory: %v", job.JobID, err)
		return
	}
	// Erstelle Download-Ordner, falls nicht vorhanden
	if err := os.MkdirAll(job.DownloadDir, 0755); err != nil {
		log.Printf("[%s] Error creating download directory: %v", job.JobID, err)
		return
	}

	watcher, err := fsnotify.NewWatcher()
	if err != nil {
		log.Printf("[%s] Error creating file watcher: %v", job.JobID, err)
		return
	}
	defer watcher.Close()

	// Überwache den job-spezifischen Upload-Ordner
	if err := watcher.Add(job.UploadDir); err != nil {
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
			// Reagiere nur auf Create-Events
			if event.Op&fsnotify.Create == fsnotify.Create {
				processFile(job, client, event.Name)
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

	// Blockiere main(), damit alle Goroutinen aktiv bleiben
	select {}
}
