package http

import (
	"errors"
	"net/http"

	tokensvc "github.com/stefanposs/file-flux/backend/application/token"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// TokenHandler verarbeitet Token-Anfragen.
type TokenHandler struct {
	service *tokensvc.Service
}

// NewTokenHandler erstellt einen neuen TokenHandler.
func NewTokenHandler(service *tokensvc.Service) *TokenHandler {
	return &TokenHandler{service: service}
}

type tokenRequest struct {
	AgentID     int     `json:"agent_id"`
	Name        string  `json:"name"`
	ExpiresIn   *int    `json:"expires_in"`
	Description *string `json:"description"`
}

// GetTokens gibt alle Tokens zurueck.
func (h *TokenHandler) GetTokens(w http.ResponseWriter, r *http.Request) {
	tokens, err := h.service.List(r.Context())
	if err != nil {
		respondError(w, http.StatusInternalServerError, "failed to get tokens")
		return
	}
	respondJSON(w, http.StatusOK, tokens)
}

// CreateToken erstellt ein neues Token.
func (h *TokenHandler) CreateToken(w http.ResponseWriter, r *http.Request) {
	var req tokenRequest
	if err := decodeJSON(r, &req); err != nil {
		respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	result, err := h.service.Create(r.Context(), tokensvc.CreateInput{
		AgentID:     req.AgentID,
		Name:        req.Name,
		ExpiresIn:   req.ExpiresIn,
		Description: req.Description,
	})
	if err != nil {
		if errors.Is(err, common.ErrValidation) {
			respondError(w, http.StatusBadRequest, err.Error())
			return
		}
		respondError(w, http.StatusInternalServerError, "failed to create token")
		return
	}

	respondJSON(w, http.StatusCreated, map[string]interface{}{
		"token": result.Token,
		"value": result.Value,
	})
}

// RevokeToken widerruft ein Token.
func (h *TokenHandler) RevokeToken(w http.ResponseWriter, r *http.Request) {
	id, err := parseID(r)
	if err != nil {
		respondError(w, http.StatusBadRequest, "invalid token ID")
		return
	}

	if err := h.service.Revoke(r.Context(), id); err != nil {
		respondError(w, http.StatusInternalServerError, "failed to revoke token")
		return
	}
	respondJSON(w, http.StatusNoContent, nil)
}
