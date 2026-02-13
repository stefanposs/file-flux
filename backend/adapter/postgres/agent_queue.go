package postgres

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/stefanposs/file-flux/backend/domain/agent"
)

// AgentMessageQueue implementiert agent.MessageQueue mit PostgreSQL.
type AgentMessageQueue struct {
	db *sql.DB
}

// NewAgentMessageQueue erstellt eine neue AgentMessageQueue.
func NewAgentMessageQueue(pgdb *DB) *AgentMessageQueue {
	return &AgentMessageQueue{db: pgdb.Pool}
}

var _ agent.MessageQueue = (*AgentMessageQueue)(nil)

// Enqueue fügt eine neue Nachricht in die Queue ein.
func (q *AgentMessageQueue) Enqueue(ctx context.Context, agentID int, messageType string, payload json.RawMessage) error {
	_, err := q.db.ExecContext(ctx, `
		INSERT INTO agent_message_queue (agent_id, message_type, payload)
		VALUES ($1, $2, $3)
	`, agentID, messageType, payload)
	return err
}

// Poll holt unbestätigte Nachrichten für einen Agent.
// Verwendet Polling mit 1-Sekunden-Intervall bis zum Timeout.
func (q *AgentMessageQueue) Poll(ctx context.Context, agentID int, timeout time.Duration) ([]agent.QueuedMessage, error) {
	deadline := time.Now().Add(timeout)

	for {
		// Prüfe ob Context abgebrochen wurde
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		default:
		}

		// Versuche Nachrichten abzurufen und als delivered zu markieren
		messages, err := q.fetchPending(ctx, agentID)
		if err != nil {
			return nil, err
		}

		if len(messages) > 0 {
			return messages, nil
		}

		// Timeout prüfen
		if time.Now().After(deadline) {
			return nil, nil // Normaler Timeout, keine Nachrichten
		}

		// Warte 1 Sekunde bevor erneut geprüft wird
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(1 * time.Second):
		}
	}
}

// fetchPending holt alle unbestätigten Nachrichten und markiert sie als delivered.
func (q *AgentMessageQueue) fetchPending(ctx context.Context, agentID int) ([]agent.QueuedMessage, error) {
	rows, err := q.db.QueryContext(ctx, `
		UPDATE agent_message_queue
		SET delivered_at = NOW()
		WHERE id IN (
			SELECT id FROM agent_message_queue
			WHERE agent_id = $1 AND acked_at IS NULL
			ORDER BY created_at ASC
			LIMIT 50
			FOR UPDATE SKIP LOCKED
		)
		RETURNING id, agent_id, message_type, payload, created_at, delivered_at
	`, agentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var messages []agent.QueuedMessage
	for rows.Next() {
		var m agent.QueuedMessage
		if err := rows.Scan(&m.ID, &m.AgentID, &m.MessageType, &m.Payload, &m.CreatedAt, &m.DeliveredAt); err != nil {
			return nil, err
		}
		messages = append(messages, m)
	}
	return messages, rows.Err()
}

// Ack bestätigt den Empfang von Nachrichten.
func (q *AgentMessageQueue) Ack(ctx context.Context, agentID int, messageIDs []int64) error {
	if len(messageIDs) == 0 {
		return nil
	}

	// Dynamisches Placehoder-Array für lib/pq Kompatibilität
	placeholders := make([]string, len(messageIDs))
	args := make([]interface{}, len(messageIDs)+1)
	args[0] = agentID
	for i, id := range messageIDs {
		placeholders[i] = fmt.Sprintf("$%d", i+2)
		args[i+1] = id
	}

	query := fmt.Sprintf(`
		UPDATE agent_message_queue
		SET acked_at = NOW()
		WHERE agent_id = $1 AND id IN (%s)
	`, strings.Join(placeholders, ","))

	_, err := q.db.ExecContext(ctx, query, args...)
	return err
}

// Cleanup entfernt alte bestätigte Nachrichten.
func (q *AgentMessageQueue) Cleanup(ctx context.Context, olderThan time.Duration) error {
	cutoff := time.Now().Add(-olderThan)
	_, err := q.db.ExecContext(ctx, `
		DELETE FROM agent_message_queue
		WHERE (acked_at IS NOT NULL AND acked_at < $1)
		   OR (created_at < $2 AND acked_at IS NULL)
	`, cutoff, cutoff)
	return err
}

// int64ArrayToString konvertiert ein []int64 in ein komma-getrenntes String (für Logging).
func int64ArrayToString(ids []int64) string {
	s := make([]string, len(ids))
	for i, id := range ids {
		s[i] = strconv.FormatInt(id, 10)
	}
	return strings.Join(s, ",")
}
