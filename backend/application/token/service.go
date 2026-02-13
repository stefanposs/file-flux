// Package token implementiert den Token-Service der Application-Schicht.
package token

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/common"
	"github.com/stefanposs/file-flux/backend/domain/token"
)

// Service implementiert die Token-Geschaeftslogik.
type Service struct {
	tokens token.Repository
}

// NewService erstellt einen neuen TokenService.
func NewService(tokens token.Repository) *Service {
	return &Service{tokens: tokens}
}

// List gibt alle Tokens zurueck.
func (s *Service) List(ctx context.Context) ([]token.Token, error) {
	return s.tokens.List(ctx)
}

// CreateInput enthaelt die Eingabedaten fuer die Token-Erstellung.
type CreateInput struct {
	AgentID     int
	Name        string
	ExpiresIn   *int
	Description *string
}

// CreateResult enthaelt das Ergebnis einer Token-Erstellung.
type CreateResult struct {
	Token *token.Token
	Value string
}

// Create erstellt ein neues Agent-Token.
func (s *Service) Create(ctx context.Context, input CreateInput) (*CreateResult, error) {
	if input.Name == "" {
		return nil, errors.Join(common.ErrValidation, errors.New("token name is required"))
	}
	if input.AgentID == 0 {
		return nil, errors.Join(common.ErrValidation, errors.New("agent ID is required"))
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		return nil, errors.Join(common.ErrInternal, err)
	}
	tokenValue := hex.EncodeToString(tokenBytes)

	t := &token.Token{
		AgentID: input.AgentID,
		Name:    input.Name,
		Value:   tokenValue,
	}

	if input.Description != nil {
		t.Description = input.Description
	}

	if input.ExpiresIn != nil && *input.ExpiresIn > 0 {
		exp := time.Now().AddDate(0, 0, *input.ExpiresIn)
		t.ExpiresAt = &exp
	}

	if err := s.tokens.Create(ctx, t); err != nil {
		return nil, err
	}

	return &CreateResult{
		Token: t,
		Value: tokenValue,
	}, nil
}

// Revoke widerruft ein Token.
func (s *Service) Revoke(ctx context.Context, id int) error {
	return s.tokens.Delete(ctx, id)
}

// Validate validiert einen Token-Wert und gibt die zugehoerige Agent-ID zurueck.
func (s *Service) Validate(ctx context.Context, tokenValue string) (int, error) {
	if tokenValue == "" {
		return 0, common.ErrUnauthorized
	}
	return s.tokens.Validate(ctx, tokenValue)
}
