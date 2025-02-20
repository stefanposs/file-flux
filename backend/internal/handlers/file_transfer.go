package handlers

import (
	"io"
	"net/http"
	"os"

	"github.com/stefanposs/file-flux/backend/internal/services"

	"encoding/json"

	"github.com/gorilla/mux"
)

type FileTransferHandler struct {
	Service *services.FileTransferService
}

func NewFileTransferHandler(service *services.FileTransferService) *FileTransferHandler {
	return &FileTransferHandler{Service: service}
}

func (h *FileTransferHandler) HandleFileUpload(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	if _, err := h.Service.UploadFile(file, nil); err != nil {
		http.Error(w, "Failed to upload file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "File uploaded successfully"})
}

func (h *FileTransferHandler) HandleFileDownload(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fileID := vars["id"]

	file, err := h.Service.DownloadFile(fileID)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	tempFile, err := os.CreateTemp("", "downloaded-*")
	if err != nil {
		http.Error(w, "Failed to create temp file", http.StatusInternalServerError)
		return
	}
	defer tempFile.Close()

	if _, err := io.Copy(tempFile, file); err != nil {
		http.Error(w, "Failed to save file", http.StatusInternalServerError)
		return
	}

	http.ServeFile(w, r, tempFile.Name())
}

func (h *FileTransferHandler) HandleLongPollingUpload(w http.ResponseWriter, r *http.Request) {
	err := r.ParseMultipartForm(10 << 20) // 10 MB
	if err != nil {
		http.Error(w, "File is required", http.StatusBadRequest)
		return
	}

	file, _, err := r.FormFile("file")
	if err != nil {
		http.Error(w, "Failed to open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	if err := h.Service.LongPollingUpload(file, nil); err != nil {
		http.Error(w, "Failed to upload file", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"message": "File uploaded successfully"})
}

func (h *FileTransferHandler) HandleLongPollingDownload(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	fileID := vars["id"]

	file, err := h.Service.LongPollingDownload(fileID)
	if err != nil {
		http.Error(w, "File not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	buffer := make([]byte, 1024*1024) // 1 MB chunks
	for {
		n, err := file.Read(buffer)
		if err != nil && err != io.EOF {
			http.Error(w, "Failed to read file", http.StatusInternalServerError)
			return
		}
		if n == 0 {
			break
		}

		if _, err := w.Write(buffer[:n]); err != nil {
			http.Error(w, "Failed to write file", http.StatusInternalServerError)
			return
		}
	}
}
