package handlers

import (
	"log"
	"net/http"

	"github.com/stefanposs/file-flux/backend/internal/services"
)

type FileTransferHandler struct {
	Service *services.FileTransferService
}

func NewFileTransferHandler(service *services.FileTransferService) *FileTransferHandler {
	return &FileTransferHandler{Service: service}
}

func (h *FileTransferHandler) HandleLongPollingUpload(w http.ResponseWriter, r *http.Request) {
	if err := h.Service.LongPollingUpload(w, r); err != nil {
		log.Printf("Error in LongPollingUpload: %v", err)
		// Hier keine weitere WriteHeader, da die Servicefunktion bereits Fehler meldet.
		return
	}
}

func (h *FileTransferHandler) HandleLongPollingDownload(w http.ResponseWriter, r *http.Request) {
	if err := h.Service.LongPollingDownload(w, r); err != nil {
		log.Printf("Error in LongPollingDownload: %v", err)
		// Auch hier keine weitere WriteHeader.
		return
	}
}
