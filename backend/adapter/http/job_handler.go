package http

import (
	"errors"
	"net/http"

	jobsvc "github.com/stefanposs/file-flux/backend/application/job"
	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/job"
	"github.com/stefanposs/file-flux/backend/internal/middleware"
)

// JobHandler verarbeitet Job-Anfragen.
type JobHandler struct {
	service *jobsvc.Service
}

// NewJobHandler erstellt einen neuen JobHandler.
func NewJobHandler(service *jobsvc.Service) *JobHandler {
	return &JobHandler{service: service}
}

type jobRequest struct {
	Name               string  `json:"name"`
	Type               string  `json:"type"`
	Schedule           *string `json:"schedule"`
	SourcePath         string  `json:"source_path"`
	DestinationPath    string  `json:"destination_path"`
	SourceAgentID      int     `json:"source_agent_id"`
	DestinationAgentID int     `json:"destination_agent_id"`
	Description        *string `json:"description"`
}

func getUserID(r *http.Request) (int, bool) {
	userID, ok := r.Context().Value(middleware.UserIDKey).(int)
	return userID, ok
}

// GetJobs gibt alle Jobs des Benutzers zurueck.
func (h *JobHandler) GetJobs(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	jobs, err := h.service.ListByUser(r.Context(), userID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get jobs")
		return
	}
	respondJSON(w, http.StatusOK, jobs)
}

// GetJob gibt einen einzelnen Job zurueck.
func (h *JobHandler) GetJob(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid job ID")
		return
	}

	j, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, common.ErrNotFound) {
			respondError(w, http.StatusNotFound, "job not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get job")
		return
	}
	respondJSON(w, http.StatusOK, j)
}

// CreateJob erstellt einen neuen Job.
func (h *JobHandler) CreateJob(w http.ResponseWriter, r *http.Request) {
	userID, ok := getUserID(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "unauthorized")
		return
	}

	var req jobRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	j := &job.Job{
		UserID:             userID,
		Name:               req.Name,
		Type:               job.Type(req.Type),
		Schedule:           req.Schedule,
		SourcePath:         req.SourcePath,
		DestinationPath:    req.DestinationPath,
		SourceAgentID:      req.SourceAgentID,
		DestinationAgentID: req.DestinationAgentID,
		Description:        req.Description,
	}

	if err := h.service.Create(r.Context(), j); err != nil {
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create job")
		return
	}
	respondJSON(w, http.StatusCreated, j)
}

// UpdateJob aktualisiert einen Job.
func (h *JobHandler) UpdateJob(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid job ID")
		return
	}

	// Bestehenden Job laden, um UserID zu bewahren
	existing, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		respondError(w, http.StatusNotFound, "job not found")
		return
	}

	var req jobRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	j := &job.Job{
		ID:                 id,
		UserID:             existing.UserID,
		Name:               req.Name,
		Type:               job.Type(req.Type),
		Status:             existing.Status,
		Schedule:           req.Schedule,
		SourcePath:         req.SourcePath,
		DestinationPath:    req.DestinationPath,
		SourceAgentID:      req.SourceAgentID,
		DestinationAgentID: req.DestinationAgentID,
		Description:        req.Description,
	}

	if err := h.service.Update(r.Context(), j); err != nil {
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update job")
		return
	}
	respondJSON(w, http.StatusOK, j)
}

// DeleteJob loescht einen Job.
func (h *JobHandler) DeleteJob(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid job ID")
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete job")
		return
	}
	respondNoContent(w)
}

// RunJob startet die Ausfuehrung eines Jobs.
func (h *JobHandler) RunJob(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid job ID")
		return
	}

	if err := h.service.Run(r.Context(), id); err != nil {
		if errors.Is(err, common.ErrNotFound) {
			respondError(w, http.StatusNotFound, "job not found")
			return
		}
		if errors.Is(err, common.ErrAgentNotConnected) {
			respondError(w, http.StatusServiceUnavailable, "source agent not connected")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to run job")
		return
	}
	respondJSON(w, http.StatusOK, map[string]string{"status": "running"})
}
