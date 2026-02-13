// Package common definiert gemeinsame Fehler und Typen für die Domain-Schicht.
package common

import "errors"

// Gemeinsame Fehler
var (
	ErrNotFound     = errors.New("not found")
	ErrUnauthorized = errors.New("unauthorized")
	ErrForbidden    = errors.New("forbidden")
	ErrConflict     = errors.New("conflict")
	ErrInternal     = errors.New("internal error")
	ErrValidation   = errors.New("validation error")

	// WebSocket-bezogene Fehler
	ErrAgentNotConnected = errors.New("agent not connected")
	ErrAgentChannelFull  = errors.New("agent channel full")
)
