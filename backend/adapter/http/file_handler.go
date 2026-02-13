package http

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/gorilla/mux"
)

// FileHandler verarbeitet Datei-Upload- und -Download-Anfragen von Agenten.
type FileHandler struct {
	storageDir     string
	tokenValidator TokenValidatorFunc
}

// TokenValidatorFunc validiert ein Agent-Token und gibt die agentID zurueck.
type TokenValidatorFunc func(token string) (int, error)

// NewFileHandler erstellt einen neuen FileHandler.
func NewFileHandler(storageDir string, tokenValidator TokenValidatorFunc) *FileHandler {
	os.MkdirAll(storageDir, 0o755)
	return &FileHandler{storageDir: storageDir, tokenValidator: tokenValidator}
}

// Upload empfaengt eine Datei vom Agenten und speichert sie auf dem Server.
// PUT /api/files/{transferId}/upload
func (h *FileHandler) Upload(w http.ResponseWriter, r *http.Request) {
	agentID, ok := h.authenticateAgent(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	transferID, err := strconv.Atoi(mux.Vars(r)["transferId"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid transfer ID")
		return
	}

	// Zielverzeichnis: storage/<transferId>/
	dir := filepath.Join(h.storageDir, fmt.Sprintf("transfer-%d", transferID))
	os.MkdirAll(dir, 0o755)

	// Dateiname aus Header oder Query
	filename := r.URL.Query().Get("filename")
	if filename == "" {
		filename = "file.dat"
	}
	// Pfad-Traversal verhindern
	filename = filepath.Base(filename)

	dstPath := filepath.Join(dir, filename)
	dst, err := os.Create(dstPath)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to create file")
		return
	}
	defer dst.Close()

	written, err := io.Copy(dst, r.Body)
	if err != nil {
		os.Remove(dstPath)
		respondError(w, http.StatusInternalServerError, "failed to write file")
		return
	}

	_ = agentID // Zukuenftig fuer Audit-Log

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"transfer_id": transferID,
		"filename":    filename,
		"size":        written,
	})
}

// Download sendet eine gespeicherte Datei an den Agenten.
// GET /api/files/{transferId}/download
func (h *FileHandler) Download(w http.ResponseWriter, r *http.Request) {
	_, ok := h.authenticateAgent(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	transferID, err := strconv.Atoi(mux.Vars(r)["transferId"])
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid transfer ID")
		return
	}

	dir := filepath.Join(h.storageDir, fmt.Sprintf("transfer-%d", transferID))

	// Finde die (erste) Datei im Transferverzeichnis
	entries, err := os.ReadDir(dir)
	if err != nil || len(entries) == 0 {
		respondError(w, http.StatusNotFound, "transfer file not found")
		return
	}

	var filename string
	for _, e := range entries {
		if !e.IsDir() {
			filename = e.Name()
			break
		}
	}
	if filename == "" {
		respondError(w, http.StatusNotFound, "transfer file not found")
		return
	}

	srcPath := filepath.Join(dir, filename)
	file, err := os.Open(srcPath)
	if err != nil {
		respondError(w, http.StatusNotFound, "transfer file not found")
		return
	}
	defer file.Close()

	stat, _ := file.Stat()
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.FormatInt(stat.Size(), 10))
	io.Copy(w, file)
}

// authenticateAgent prueft den Agent-Token aus dem Authorization-Header.
func (h *FileHandler) authenticateAgent(r *http.Request) (int, bool) {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return 0, false
	}
	token := strings.TrimPrefix(auth, "Bearer ")
	agentID, err := h.tokenValidator(token)
	if err != nil {
		return 0, false
	}
	return agentID, true
}
