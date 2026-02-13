package http

import (
	"errors"
	"net/http"

	agentsvc "github.com/stefanposs/file-flux/backend/application/agent"
	"github.com/stefanposs/file-flux/backend/domain/agent"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// AgentHandler verarbeitet Agent-Anfragen.
type AgentHandler struct {
	service *agentsvc.Service
}

// NewAgentHandler erstellt einen neuen AgentHandler.
func NewAgentHandler(service *agentsvc.Service) *AgentHandler {
	return &AgentHandler{service: service}
}

type agentRequest struct {
	Name        string  `json:"name"`
	Type        string  `json:"type"`
	Description *string `json:"description"`
}

// GetAgents gibt alle Agenten zurueck.
func (h *AgentHandler) GetAgents(w http.ResponseWriter, r *http.Request) {
	agents, err := h.service.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get agents")
		return
	}
	respondJSON(w, http.StatusOK, agents)
}

// GetAgent gibt einen einzelnen Agenten zurueck.
func (h *AgentHandler) GetAgent(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid agent ID")
		return
	}

	a, err := h.service.GetByID(r.Context(), id)
	if err != nil {
		if errors.Is(err, common.ErrNotFound) {
			respondError(w, http.StatusNotFound, "agent not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to get agent")
		return
	}
	respondJSON(w, http.StatusOK, a)
}

// CreateAgent erstellt einen neuen Agenten.
func (h *AgentHandler) CreateAgent(w http.ResponseWriter, r *http.Request) {
	var req agentRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	a := &agent.Agent{
		Name:        req.Name,
		Type:        req.Type,
		Description: req.Description,
	}

	if err := h.service.Create(r.Context(), a); err != nil {
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create agent")
		return
	}
	respondJSON(w, http.StatusCreated, a)
}

// UpdateAgent aktualisiert einen Agenten.
func (h *AgentHandler) UpdateAgent(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid agent ID")
		return
	}

	var req agentRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	a := &agent.Agent{
		ID:          id,
		Name:        req.Name,
		Type:        req.Type,
		Description: req.Description,
	}

	if err := h.service.Update(r.Context(), a); err != nil {
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to update agent")
		return
	}
	respondJSON(w, http.StatusOK, a)
}

// DeleteAgent loescht einen Agenten.
func (h *AgentHandler) DeleteAgent(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid agent ID")
		return
	}

	if err := h.service.Delete(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to delete agent")
		return
	}
	respondNoContent(w)
}

// TestConnection prueft die WebSocket-Verbindung eines Agenten.
func (h *AgentHandler) TestConnection(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid agent ID")
		return
	}

	connected, err := h.service.TestConnection(r.Context(), id)
	if err != nil {
		if errors.Is(err, common.ErrNotFound) {
			respondError(w, http.StatusNotFound, "agent not found")
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to test connection")
		return
	}
	respondJSON(w, http.StatusOK, map[string]bool{"connected": connected})
}
