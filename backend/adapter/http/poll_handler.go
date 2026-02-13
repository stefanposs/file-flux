package http

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"strconv"
	"time"

	agentdomain "github.com/stefanposs/file-flux/backend/domain/agent"
)

// PollDeps enthält die Abhängigkeiten des PollHandlers.
type PollDeps struct {
	TokenValidator TokenValidatorFunc
	AgentRepo      agentdomain.Repository
	MessageQueue   agentdomain.MessageQueue
	MessageRouter  PollMessageRouter
	Logger         *log.Logger
	PollingTracker PollingTracker // optional: benachrichtigt den Dispatcher über aktive Poller
}

// PollMessageRouter verarbeitet eingehende Agent-Nachrichten (analog zu WS handleMessage).
type PollMessageRouter interface {
	HandleAgentMessage(ctx context.Context, agentID int, messageType string, data json.RawMessage) error
}

// PollingTracker benachrichtigt den Dispatcher über aktive Polling-Agents.
type PollingTracker interface {
	MarkPollingActive(agentID int)
}

// PollHandler verarbeitet HTTP Long-Polling Anfragen von Agenten.
type PollHandler struct {
	tokenValidator TokenValidatorFunc
	agents         agentdomain.Repository
	queue          agentdomain.MessageQueue
	router         PollMessageRouter
	logger         *log.Logger
	tracker        PollingTracker
}

// NewPollHandler erstellt einen neuen PollHandler.
func NewPollHandler(deps PollDeps) *PollHandler {
	return &PollHandler{
		tokenValidator: deps.TokenValidator,
		agents:         deps.AgentRepo,
		queue:          deps.MessageQueue,
		router:         deps.MessageRouter,
		logger:         deps.Logger,
		tracker:        deps.PollingTracker,
	}
}

// Connect registriert einen Agent via HTTP und setzt den Status auf online.
// POST /api/agent/connect
func (h *PollHandler) Connect(w http.ResponseWriter, r *http.Request) {
	agentID, ok := h.authenticateAgent(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	// Request-Body lesen (Agent-Info)
	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize))
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	var payload struct {
		SystemInfo *struct {
			System    string `json:"os_name"`
			IPAddress string `json:"ip_address"`
			Version   string `json:"version"`
		} `json:"system_info"`
		Transport string `json:"transport"`
	}

	if len(body) > 0 {
		if err := json.Unmarshal(body, &payload); err != nil {
			respondError(w, http.StatusBadRequest, "invalid JSON body")
			return
		}
	}

	ctx := r.Context()

	// Agent als online markieren
	if err := h.agents.UpdateStatus(ctx, agentID, "online"); err != nil {
		h.logger.Printf("[POLL] Fehler beim Setzen des Agent-Status: %v", err)
	}

	// Transport-Modus setzen
	mode := "polling"
	if payload.Transport != "" {
		mode = payload.Transport
	}
	if err := h.agents.UpdateTransportMode(ctx, agentID, mode); err != nil {
		h.logger.Printf("[POLL] Fehler beim Setzen des Transport-Modus: %v", err)
	}

	// Last-Poll aktualisieren
	if err := h.agents.UpdateLastPoll(ctx, agentID); err != nil {
		h.logger.Printf("[POLL] Fehler beim Aktualisieren von last_poll_at: %v", err)
	}

	// Agent-Info aktualisieren, falls mitgesendet
	if payload.SystemInfo != nil {
		si := payload.SystemInfo
		if err := h.agents.UpdateInfo(ctx, agentID, si.System, si.IPAddress, si.Version); err != nil {
			h.logger.Printf("[POLL] Fehler beim Aktualisieren der Agent-Info: %v", err)
		}
	}

	h.logger.Printf("[POLL] Agent %d verbunden (Transport: %s)", agentID, mode)

	// Dispatcher über aktiven Poller informieren
	if h.tracker != nil {
		h.tracker.MarkPollingActive(agentID)
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":   "connected",
		"agent_id": agentID,
		"mode":     mode,
	})
}

// Poll führt einen Long-Poll aus. Hält die Verbindung offen bis Nachrichten kommen oder Timeout.
// GET /api/agent/poll?timeout=30
func (h *PollHandler) Poll(w http.ResponseWriter, r *http.Request) {
	agentID, ok := h.authenticateAgent(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	// Timeout aus Query (default: 30 Sekunden)
	timeout := 30 * time.Second
	if t := r.URL.Query().Get("timeout"); t != "" {
		if secs, err := strconv.Atoi(t); err == nil && secs > 0 && secs <= 120 {
			timeout = time.Duration(secs) * time.Second
		}
	}

	// Last-Poll und Status aktualisieren (jeder Poll gilt als Heartbeat)
	ctx := r.Context()
	if err := h.agents.UpdateLastPoll(ctx, agentID); err != nil {
		h.logger.Printf("[POLL] Fehler beim Aktualisieren von last_poll_at: %v", err)
	}
	if err := h.agents.UpdateStatus(ctx, agentID, "online"); err != nil {
		h.logger.Printf("[POLL] Fehler beim Aktualisieren des Agent-Status: %v", err)
	}

	// Dispatcher über aktiven Poller informieren
	if h.tracker != nil {
		h.tracker.MarkPollingActive(agentID)
	}

	// Long-Poll: blockiert bis Nachrichten kommen oder Timeout
	// Verwende Context mit Timeout — Request wird abgebrochen wenn Client disconnectet
	pollCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	messages, err := h.queue.Poll(pollCtx, agentID, timeout)
	if err != nil {
		if err == context.Canceled || err == context.DeadlineExceeded {
			// Normaler Timeout — keine Nachrichten
			w.WriteHeader(http.StatusNoContent)
			return
		}
		h.logger.Printf("[POLL] Fehler beim Abrufen der Nachrichten: %v", err)
		respondError(w, http.StatusInternalServerError, "poll failed")
		return
	}

	if len(messages) == 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Nachrichten in das Format konvertieren, das der Agent erwartet
	response := make([]struct {
		ID      int64 `json:"id"`
		Message struct {
			Type string          `json:"type"`
			Data json.RawMessage `json:"data"`
		} `json:"message"`
	}, len(messages))

	for i, m := range messages {
		response[i].ID = m.ID
		response[i].Message.Type = m.MessageType
		response[i].Message.Data = m.Payload
	}

	respondJSON(w, http.StatusOK, response)
}

// Messages empfängt Nachrichten vom Agent (Status-Updates, Progress, etc.).
// POST /api/agent/messages
func (h *PollHandler) Messages(w http.ResponseWriter, r *http.Request) {
	agentID, ok := h.authenticateAgent(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize))
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	var msg struct {
		Type string          `json:"type"`
		Data json.RawMessage `json:"data"`
	}
	if err := json.Unmarshal(body, &msg); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	ctx := r.Context()

	// Nachricht an den Message-Router weiterleiten (gleiche Logik wie WS handleMessage)
	if h.router != nil {
		if err := h.router.HandleAgentMessage(ctx, agentID, msg.Type, msg.Data); err != nil {
			h.logger.Printf("[POLL] Fehler beim Verarbeiten der Nachricht von Agent %d: %v", agentID, err)
			respondError(w, http.StatusInternalServerError, "message processing failed")
			return
		}
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// Ack bestätigt den Empfang von Nachrichten.
// POST /api/agent/ack
func (h *PollHandler) Ack(w http.ResponseWriter, r *http.Request) {
	agentID, ok := h.authenticateAgent(r)
	if !ok {
		respondError(w, http.StatusUnauthorized, "invalid agent token")
		return
	}

	body, err := io.ReadAll(io.LimitReader(r.Body, maxBodySize))
	if err != nil {
		respondError(w, http.StatusBadRequest, "failed to read request body")
		return
	}

	var payload struct {
		MessageIDs []int64 `json:"message_ids"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		respondError(w, http.StatusBadRequest, "invalid JSON body")
		return
	}

	ctx := r.Context()
	if err := h.queue.Ack(ctx, agentID, payload.MessageIDs); err != nil {
		h.logger.Printf("[POLL] Fehler beim ACK von Nachrichten für Agent %d: %v", agentID, err)
		respondError(w, http.StatusInternalServerError, "ack failed")
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

// authenticateAgent validiert das Agent-Token und gibt die agentID zurück.
func (h *PollHandler) authenticateAgent(r *http.Request) (int, bool) {
	token := r.Header.Get("Authorization")
	if token == "" {
		return 0, false
	}
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	agentID, err := h.tokenValidator(token)
	if err != nil {
		return 0, false
	}
	return agentID, true
}
