package http

import (
	"errors"
	"net/http"

	transfersvc "github.com/stefanposs/file-flux/backend/application/transfer"
	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/transfer"
	"github.com/stefanposs/file-flux/backend/internal/middleware"
)

// TransferHandler verarbeitet Transfer-Anfragen.
type TransferHandler struct {
	service *transfersvc.Service
}

// NewTransferHandler erstellt einen neuen TransferHandler.
func NewTransferHandler(service *transfersvc.Service) *TransferHandler {
	return &TransferHandler{service: service}
}

type transferRequest struct {
	JobID              *int   `json:"job_id"`
	Filename           string `json:"filename"`
	Size               int64  `json:"size"`
	SourcePath         string `json:"source_path"`
	DestinationPath    string `json:"destination_path"`
	SourceAgentID      *int   `json:"source_agent_id"`
	DestinationAgentID *int   `json:"destination_agent_id"`
}

// GetTransfers gibt alle Transfers des Benutzers zurueck.
func (h *TransferHandler) GetTransfers(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	transfers, err := h.service.ListByUser(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get transfers")
		return
	}
	respondJSON(w, http.StatusOK, transfers)
}

// GetTransfer gibt einen einzelnen Transfer zurueck.
func (h *TransferHandler) GetTransfer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid transfer ID")
		return
	}

	t, err := h.service.GetByIDForUser(r.Context(), id, userID)
	if err != nil {
		if errors.Is(err, common.ErrNotFound) {
			respondError(w, http.StatusNotFound, "transfer not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get transfer")
		return
	}
	respondJSON(w, http.StatusOK, t)
}

// CreateTransfer erstellt einen neuen Transfer.
func (h *TransferHandler) CreateTransfer(w http.ResponseWriter, r *http.Request) {
	var req transferRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	t := &transfer.Transfer{
		JobID:              req.JobID,
		Filename:           req.Filename,
		Size:               req.Size,
		SourcePath:         req.SourcePath,
		DestinationPath:    req.DestinationPath,
		SourceAgentID:      req.SourceAgentID,
		DestinationAgentID: req.DestinationAgentID,
	}

	if err := h.service.Create(r.Context(), t); err != nil {
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create transfer")
		return
	}
	respondJSON(w, http.StatusCreated, t)
}

// CancelTransfer bricht einen Transfer ab.
func (h *TransferHandler) CancelTransfer(w http.ResponseWriter, r *http.Request) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid transfer ID")
		return
	}

	// Ownership pruefen
	_, err = h.service.GetByIDForUser(r.Context(), id, userID)
	if err != nil {
		respondError(w, http.StatusNotFound, "transfer not found")
		return
	}

	if err := h.service.Cancel(r.Context(), id); err != nil {
		if errors.Is(err, common.ErrNotFound) {
			respondError(w, http.StatusNotFound, "transfer not found")
			return
		}
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to cancel transfer")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "cancelled"})
}
