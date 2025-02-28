package services

import (
	"errors"
	"io"
	"net/http"
	"sync"

	"github.com/stefanposs/file-flux/backend/pkg/config"
)

type Job struct {
	ID            string
	UploadToken   string
	DownloadToken string
}

type FileTransferService struct {
	// jobs: Map jobID -> Job (aus config.yml geladen)
	jobs map[string]Job
}

// fileStorage speichert den Dateiinhalt pro Job (In-Memory, z. B. als Zwischenpuffer)
var (
	fileStorage = make(map[string][]byte)
	storageMu   sync.Mutex
)

// NewFileTransferService erstellt einen FileTransferService und lädt die Jobs aus der Backend-Konfiguration.
func NewFileTransferService(cfg *config.Config) *FileTransferService {
	jobs := make(map[string]Job)
	for _, j := range cfg.Jobs {
		jobs[j.ID] = Job{
			ID:            j.ID,
			UploadToken:   j.UploadToken,
			DownloadToken: j.DownloadToken,
		}
	}
	return &FileTransferService{
		jobs: jobs,
	}
}

// LongPollingUpload liest den Dateiinhalt aus dem Request und speichert ihn unter der jeweiligen Job-ID.
// Es wird geprüft, ob die übermittelten Parameter job und token gültig sind.
func (s *FileTransferService) LongPollingUpload(w http.ResponseWriter, r *http.Request) error {
	jobID := r.URL.Query().Get("job")
	token := r.URL.Query().Get("token")
	if jobID == "" || token == "" {
		http.Error(w, "Job ID and token required", http.StatusBadRequest)
		return errors.New("job id and token required")
	}
	job, exists := s.jobs[jobID]
	if !exists || token != job.UploadToken {
		http.Error(w, "Invalid job or upload token", http.StatusUnauthorized)
		return errors.New("invalid job or token")
	}

	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return err
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return err
	}
	defer file.Close()

	data, err := io.ReadAll(file)
	if err != nil {
		http.Error(w, "Failed to read file", http.StatusInternalServerError)
		return err
	}

	storageMu.Lock()
	fileStorage[jobID] = data
	storageMu.Unlock()

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("File uploaded successfully"))
	return nil
}

// LongPollingDownload liefert den im In-Memory-Speicher abgelegten Dateicontent zurück und löscht diesen anschließend.
// Auch hier erfolgt die Prüfung mit Job-ID und passendem Download-Token.
func (s *FileTransferService) LongPollingDownload(w http.ResponseWriter, r *http.Request) error {
	jobID := r.URL.Query().Get("job")
	token := r.URL.Query().Get("token")
	if jobID == "" || token == "" {
		http.Error(w, "Job ID and token required", http.StatusBadRequest)
		return errors.New("job id and token required")
	}
	job, exists := s.jobs[jobID]
	if !exists || token != job.DownloadToken {
		http.Error(w, "Invalid job or download token", http.StatusUnauthorized)
		return errors.New("invalid job or token")
	}

	storageMu.Lock()
	data, ok := fileStorage[jobID]
	if !ok {
		storageMu.Unlock()
		http.Error(w, "File not found", http.StatusNotFound)
		return errors.New("file not found")
	}
	delete(fileStorage, jobID)
	storageMu.Unlock()

	w.WriteHeader(http.StatusOK)
	_, err := w.Write(data)
	return err
}
