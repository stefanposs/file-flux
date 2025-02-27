package services

import (
	"errors"
	"io"
	"net/http"
	"sync"
)

type FileTransferService struct{}

var (
	// fileStorage speichert die Dateiinhalte (Schlüssel: Dateiname)
	fileStorage = make(map[string][]byte)
	// storageMu schützt fileStorage
	storageMu sync.Mutex
)

func NewFileTransferService() *FileTransferService {
	return &FileTransferService{}
}

// LongPollingUpload liest die hochgeladene Datei vollständig ein und speichert sie im Speicher.
func (s *FileTransferService) LongPollingUpload(w http.ResponseWriter, r *http.Request) error {
	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return err
	}

	file, fileHeader, err := r.FormFile("file")
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

	// Datei im In-Memory-Speicher ablegen
	storageMu.Lock()
	fileStorage[fileHeader.Filename] = data
	storageMu.Unlock()

	w.WriteHeader(http.StatusOK)
	w.Write([]byte("File uploaded successfully"))
	return nil
}

// LongPollingDownload sucht die Datei anhand der Dateiname (fileID)
// und schreibt den Inhalt in den Response-Body, danach wird sie gelöscht.
func (s *FileTransferService) LongPollingDownload(w http.ResponseWriter, r *http.Request) error {
	fileID := r.URL.Query().Get("id")
	if fileID == "" {
		http.Error(w, "File ID is required", http.StatusBadRequest)
		return errors.New("file ID is required")
	}

	storageMu.Lock()
	data, ok := fileStorage[fileID]
	if !ok {
		storageMu.Unlock()
		http.Error(w, "File not found", http.StatusNotFound)
		return errors.New("file not found")
	}
	delete(fileStorage, fileID)
	storageMu.Unlock()

	w.WriteHeader(http.StatusOK)
	_, err := w.Write(data)
	return err
}
