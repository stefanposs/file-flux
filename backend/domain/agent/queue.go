package agent

import (
	"context"
	"encoding/json"
	"time"
)

// QueuedMessage ist eine Nachricht in der Agent-Message-Queue.
type QueuedMessage struct {
	ID          int64           `json:"id"`
	AgentID     int             `json:"agent_id"`
	MessageType string          `json:"message_type"`
	Payload     json.RawMessage `json:"payload"`
	CreatedAt   time.Time       `json:"created_at"`
	DeliveredAt *time.Time      `json:"delivered_at,omitempty"`
	AckedAt     *time.Time      `json:"acked_at,omitempty"`
}

// MessageQueue definiert die Schnittstelle für die Agent-Message-Queue.
// Wird für HTTP Long-Polling als Alternative zu WebSocket verwendet.
type MessageQueue interface {
	// Enqueue fügt eine neue Nachricht in die Queue ein.
	Enqueue(ctx context.Context, agentID int, messageType string, payload json.RawMessage) error

	// Poll holt unbestätigte Nachrichten für einen Agent.
	// Blockiert bis zu timeout oder bis Nachrichten verfügbar sind.
	Poll(ctx context.Context, agentID int, timeout time.Duration) ([]QueuedMessage, error)

	// Ack bestätigt den Empfang von Nachrichten.
	Ack(ctx context.Context, agentID int, messageIDs []int64) error

	// Cleanup entfernt alte bestätigte Nachrichten.
	Cleanup(ctx context.Context, olderThan time.Duration) error
}
