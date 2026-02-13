// Package dispatch implementiert den HybridDispatcher, der Nachrichten
// entweder via WebSocket oder über die Message-Queue (für Polling-Agents) zustellt.
package dispatch

import (
	"context"
	"encoding/json"
	"log"
	"strconv"
	"sync"
	"time"

	agentdomain "github.com/stefanposs/file-flux/backend/domain/agent"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// WSDispatcher ist das Interface für den WebSocket-Manager (SendToAgent + IsConnected).
type WSDispatcher interface {
	SendToAgent(agentID int, message interface{}) error
	IsConnected(agentID int) bool
}

// HybridDispatcher versucht Nachrichten zuerst via WebSocket zu senden.
// Falls der Agent nicht via WS verbunden ist, wird die Nachricht in die
// Message-Queue eingereiht (für HTTP Long-Polling Agents).
type HybridDispatcher struct {
	ws     WSDispatcher
	queue  agentdomain.MessageQueue
	agents agentdomain.Repository
	logger *log.Logger

	// Tracking: Polling-Agents und deren letzter Poll-Zeitpunkt
	pollingAgents map[int]time.Time
	pollMu        sync.RWMutex
}

// NewHybridDispatcher erstellt einen neuen HybridDispatcher.
func NewHybridDispatcher(ws WSDispatcher, queue agentdomain.MessageQueue, agents agentdomain.Repository, logger *log.Logger) *HybridDispatcher {
	return &HybridDispatcher{
		ws:            ws,
		queue:         queue,
		agents:        agents,
		logger:        logger,
		pollingAgents: make(map[int]time.Time),
	}
}

// SendToAgent sendet eine Nachricht an einen Agent.
// Strategie: WS zuerst, dann Queue als Fallback.
func (d *HybridDispatcher) SendToAgent(agentID int, message interface{}) error {
	// Versuche zuerst WebSocket
	if d.ws.IsConnected(agentID) {
		if err := d.ws.SendToAgent(agentID, message); err == nil {
			return nil
		}
		// WS-Fehler — Fallback auf Queue
		d.logger.Printf("[DISPATCH] WS-Zustellung an Agent %d fehlgeschlagen, nutze Queue", agentID)
	}

	// Prüfe ob Agent via Polling erreichbar ist
	if !d.isPollingActive(agentID) {
		return common.ErrAgentNotConnected
	}

	// In die Message-Queue einreihen
	return d.enqueueMessage(agentID, message)
}

// IsConnected prüft ob ein Agent über irgendeinen Kanal erreichbar ist.
func (d *HybridDispatcher) IsConnected(agentID int) bool {
	if d.ws.IsConnected(agentID) {
		return true
	}
	return d.isPollingActive(agentID)
}

// MarkPollingActive wird vom PollHandler aufgerufen wenn ein Agent pollt.
func (d *HybridDispatcher) MarkPollingActive(agentID int) {
	d.pollMu.Lock()
	d.pollingAgents[agentID] = time.Now()
	d.pollMu.Unlock()
}

// MarkPollingInactive entfernt einen Agent aus dem Polling-Tracking.
func (d *HybridDispatcher) MarkPollingInactive(agentID int) {
	d.pollMu.Lock()
	delete(d.pollingAgents, agentID)
	d.pollMu.Unlock()
}

// CleanupStalePollers prüft Polling-Agents und markiert inaktive als offline.
func (d *HybridDispatcher) CleanupStalePollers(ctx context.Context, maxAge time.Duration) {
	d.pollMu.Lock()
	stale := make([]int, 0)
	for agentID, lastPoll := range d.pollingAgents {
		if time.Since(lastPoll) > maxAge {
			stale = append(stale, agentID)
		}
	}
	for _, id := range stale {
		delete(d.pollingAgents, id)
	}
	d.pollMu.Unlock()

	for _, agentID := range stale {
		d.logger.Printf("[DISPATCH] Polling-Agent %d als offline markiert (kein Poll seit >%v)", agentID, maxAge)
		if err := d.agents.UpdateStatus(ctx, agentID, "offline"); err != nil {
			d.logger.Printf("[DISPATCH] Fehler beim Offline-Setzen von Agent %d: %v", agentID, err)
		}
	}
}

// StartCleanupLoop startet eine Hintergrund-Goroutine für periodisches Cleanup.
func (d *HybridDispatcher) StartCleanupLoop(ctx context.Context, interval, maxAge time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				d.CleanupStalePollers(ctx, maxAge)
				if err := d.queue.Cleanup(ctx, 1*time.Hour); err != nil {
					d.logger.Printf("[DISPATCH] Queue-Cleanup Fehler: %v", err)
				}
			}
		}
	}()
}

// --- interne Methoden ---

func (d *HybridDispatcher) isPollingActive(agentID int) bool {
	d.pollMu.RLock()
	lastPoll, ok := d.pollingAgents[agentID]
	d.pollMu.RUnlock()
	if !ok {
		return false
	}
	return time.Since(lastPoll) < 2*time.Minute
}

func (d *HybridDispatcher) enqueueMessage(agentID int, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	var envelope struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(data, &envelope); err != nil || envelope.Type == "" {
		envelope.Type = "unknown"
	}

	ctx := context.Background()
	if err := d.queue.Enqueue(ctx, agentID, envelope.Type, json.RawMessage(data)); err != nil {
		d.logger.Printf("[DISPATCH] Fehler beim Einreihen der Nachricht für Agent %d: %v", agentID, err)
		return err
	}

	d.logger.Printf("[DISPATCH] Nachricht (%s) für Agent %d in Queue eingereiht", envelope.Type, agentID)
	return nil
}

// --- MessageRouter: verarbeitet eingehende Agent-Nachrichten ---

// TransferUpdater aktualisiert Transfer-Status/Progress.
type TransferUpdater interface {
	UpdateStatus(ctx context.Context, id int, status string, errorMsg string) error
	UpdateProgress(ctx context.Context, id int, progress float64) error
}

// TransferGetter liest Transfer-Records für Two-Phase-Dispatch.
type TransferGetter interface {
	GetByID(ctx context.Context, id int) (TransferInfo, error)
}

// TransferInfo enthält die Transfer-Daten, die der Router benötigt.
type TransferInfo struct {
	ID                 int
	SourceAgentID      *int
	DestinationAgentID *int
	SourcePath         string
	DestinationPath    string
	Filename           string
}

// AgentStatusUpdater aktualisiert Agent-Status.
type AgentStatusUpdater interface {
	UpdateStatus(ctx context.Context, id int, status string) error
	UpdateInfo(ctx context.Context, id int, system, ipAddress, version string) error
}

// MessageRouter verarbeitet eingehende Agent-Nachrichten.
type MessageRouter struct {
	agents         AgentStatusUpdater
	transfers      TransferUpdater
	transferGetter TransferGetter
	dispatcher     *HybridDispatcher
	logger         *log.Logger
}

// NewMessageRouter erstellt einen neuen MessageRouter.
func NewMessageRouter(agents AgentStatusUpdater, transfers TransferUpdater, transferGetter TransferGetter, dispatcher *HybridDispatcher, logger *log.Logger) *MessageRouter {
	return &MessageRouter{
		agents:         agents,
		transfers:      transfers,
		transferGetter: transferGetter,
		dispatcher:     dispatcher,
		logger:         logger,
	}
}

// HandleAgentMessage verarbeitet eine eingehende Nachricht von einem Agent.
func (mr *MessageRouter) HandleAgentMessage(ctx context.Context, agentID int, messageType string, data json.RawMessage) error {
	switch messageType {
	case "heartbeat":
		return mr.agents.UpdateStatus(ctx, agentID, "online")

	case "agent_info":
		var info struct {
			System    string `json:"system"`
			IPAddress string `json:"ip_address"`
			Version   string `json:"version"`
		}
		if err := json.Unmarshal(data, &info); err != nil {
			return err
		}
		return mr.agents.UpdateInfo(ctx, agentID, info.System, info.IPAddress, info.Version)

	case "transfer_progress":
		var progress struct {
			TransferID json.RawMessage `json:"transfer_id"`
			Progress   float64         `json:"progress"`
		}
		if err := json.Unmarshal(data, &progress); err != nil {
			return err
		}
		transferID := parseTransferID(progress.TransferID)
		if transferID <= 0 {
			mr.logger.Printf("[POLL-ROUTER] Ungueltige Transfer-ID im Fortschritt")
			return nil
		}
		return mr.transfers.UpdateProgress(ctx, transferID, progress.Progress)

	case "transfer_complete":
		var complete struct {
			TransferID json.RawMessage `json:"transfer_id"`
		}
		if err := json.Unmarshal(data, &complete); err != nil {
			return err
		}
		transferID := parseTransferID(complete.TransferID)
		if transferID <= 0 {
			mr.logger.Printf("[POLL-ROUTER] Ungueltige Transfer-ID in Fertigstellung")
			return nil
		}
		return mr.handleTransferComplete(ctx, agentID, transferID)

	case "transfer_error":
		var errorMsg struct {
			TransferID json.RawMessage `json:"transfer_id"`
			Error      string          `json:"error"`
		}
		if err := json.Unmarshal(data, &errorMsg); err != nil {
			return err
		}
		transferID := parseTransferID(errorMsg.TransferID)
		if transferID <= 0 {
			mr.logger.Printf("[POLL-ROUTER] Ungueltige Transfer-ID im Fehler")
			return nil
		}
		return mr.transfers.UpdateStatus(ctx, transferID, "failed", errorMsg.Error)

	default:
		mr.logger.Printf("[POLL-ROUTER] Unbekannter Nachrichtentyp: %s", messageType)
		return nil
	}
}

func (mr *MessageRouter) handleTransferComplete(ctx context.Context, agentID int, transferID int) error {
	if mr.transferGetter != nil {
		t, err := mr.transferGetter.GetByID(ctx, transferID)
		if err == nil && t.DestinationAgentID != nil && t.SourceAgentID != nil && agentID == *t.SourceAgentID {
			mr.logger.Printf("[POLL-ROUTER] Transfer %d Upload abgeschlossen, dispatche Download an Agent %d", transferID, *t.DestinationAgentID)

			downloadMsg := struct {
				Type string      `json:"type"`
				Data interface{} `json:"data"`
			}{
				Type: "transfer_request",
				Data: struct {
					Transfer struct {
						ID              string `json:"id"`
						SourcePath      string `json:"source_path"`
						DestinationPath string `json:"destination_path"`
						Compressed      bool   `json:"compressed"`
						ChunkSize       int    `json:"chunk_size"`
						TransferType    string `json:"transfer_type"`
					} `json:"transfer"`
				}{
					Transfer: struct {
						ID              string `json:"id"`
						SourcePath      string `json:"source_path"`
						DestinationPath string `json:"destination_path"`
						Compressed      bool   `json:"compressed"`
						ChunkSize       int    `json:"chunk_size"`
						TransferType    string `json:"transfer_type"`
					}{
						ID:              strconv.Itoa(transferID),
						SourcePath:      t.SourcePath,
						DestinationPath: t.DestinationPath,
						Compressed:      false,
						ChunkSize:       8,
						TransferType:    "download",
					},
				},
			}

			mr.transfers.UpdateStatus(ctx, transferID, "running", "")

			if err := mr.dispatcher.SendToAgent(*t.DestinationAgentID, downloadMsg); err != nil {
				mr.logger.Printf("[POLL-ROUTER] Fehler beim Dispatchen des Downloads an Agent %d: %v", *t.DestinationAgentID, err)
				mr.transfers.UpdateStatus(ctx, transferID, "failed", "destination agent not connected")
			}
			return nil
		}
	}

	return mr.transfers.UpdateStatus(ctx, transferID, "completed", "")
}

func parseTransferID(raw json.RawMessage) int {
	var intID int
	if err := json.Unmarshal(raw, &intID); err == nil {
		return intID
	}
	var strID string
	if err := json.Unmarshal(raw, &strID); err == nil {
		id, _ := strconv.Atoi(strID)
		return id
	}
	return 0
}
