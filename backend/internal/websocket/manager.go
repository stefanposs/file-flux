package websocket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// AgentStatusUpdater defines the agent status operations the WS manager needs.
type AgentStatusUpdater interface {
	UpdateStatus(ctx context.Context, id int, status string) error
	UpdateInfo(ctx context.Context, id int, system, ipAddress, version string) error
	UpdateTransportMode(ctx context.Context, id int, mode string) error
}

// TransferUpdater defines the transfer status operations the WS manager needs.
type TransferUpdater interface {
	UpdateStatus(ctx context.Context, id int, status string, errorMsg string) error
	UpdateProgress(ctx context.Context, id int, progress float64) error
}

// TransferGetter reads transfer records (needed for two-phase dispatch).
type TransferGetter interface {
	GetByID(ctx context.Context, id int) (TransferInfo, error)
}

// TransferInfo carries the fields of a transfer the WS manager needs.
type TransferInfo struct {
	ID                 int
	SourceAgentID      *int
	DestinationAgentID *int
	SourcePath         string
	DestinationPath    string
	Filename           string
}

// TokenValidator defines the token validation operation the WS manager needs.
type TokenValidator interface {
	Validate(ctx context.Context, tokenValue string) (agentID int, err error)
}

// Manager verwaltet WebSocket-Verbindungen zu Agenten
type Manager struct {
	clients        map[int]*Client
	clientsLock    sync.RWMutex
	agents         AgentStatusUpdater
	transfers      TransferUpdater
	transferGetter TransferGetter
	tokens         TokenValidator
	logger         *log.Logger
	upgrader       websocket.Upgrader
}

// Client repräsentiert eine WebSocket-Verbindung zu einem Agenten
type Client struct {
	conn    *websocket.Conn
	agentID int
	send    chan []byte
}

// NewManager erstellt einen neuen WebSocket-Manager
func NewManager(logger *log.Logger, agents AgentStatusUpdater, tokens TokenValidator, transfers TransferUpdater, transferGetter TransferGetter) *Manager {
	allowedOrigins := parseAllowedOrigins()

	return &Manager{
		clients:        make(map[int]*Client),
		agents:         agents,
		tokens:         tokens,
		transfers:      transfers,
		transferGetter: transferGetter,
		logger:         logger,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				// Agent-Verbindungen kommen mit Authorization-Header (kein Browser-Origin)
				if r.Header.Get("Authorization") != "" {
					return true
				}
				// Wenn keine Origins konfiguriert, alle erlauben (Development)
				if len(allowedOrigins) == 0 {
					return true
				}
				origin := r.Header.Get("Origin")
				for _, allowed := range allowedOrigins {
					if origin == allowed {
						return true
					}
				}
				logger.Printf("WebSocket-Verbindung von unerlaubtem Origin abgelehnt: %s", origin)
				return false
			},
		},
	}
}

// parseAllowedOrigins liest WS_ALLOWED_ORIGINS (kommagetrennt) aus der Umgebung.
func parseAllowedOrigins() []string {
	raw := os.Getenv("WS_ALLOWED_ORIGINS")
	if raw == "" {
		return nil
	}
	var origins []string
	for _, o := range strings.Split(raw, ",") {
		o = strings.TrimSpace(o)
		if o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}

// Handler gibt einen HTTP-Handler zurück, der WebSocket-Verbindungen akzeptiert
func (m *Manager) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		m.handleConnection(w, r)
	})
}

// handleConnection behandelt eingehende WebSocket-Verbindungen
func (m *Manager) handleConnection(w http.ResponseWriter, r *http.Request) {
	// Token aus dem Header extrahieren
	token := r.Header.Get("Authorization")
	if token == "" {
		m.logger.Println("WebSocket-Verbindung ohne Token")
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Token-Präfix entfernen (falls vorhanden)
	if len(token) > 7 && token[:7] == "Bearer " {
		token = token[7:]
	}

	// Token validieren und Agent-ID abrufen
	agentID, err := m.tokens.Validate(r.Context(), token)
	if err != nil {
		m.logger.Printf("Ungültiges Token: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// WebSocket-Verbindung upgraden
	conn, err := m.upgrader.Upgrade(w, r, nil)
	if err != nil {
		m.logger.Printf("Fehler beim Upgraden der WebSocket-Verbindung: %v", err)
		return
	}

	// Client erstellen
	client := &Client{
		conn:    conn,
		agentID: agentID,
		send:    make(chan []byte, 256),
	}

	// Agent als online markieren
	ctx := context.Background()
	if err := m.agents.UpdateStatus(ctx, agentID, "online"); err != nil {
		m.logger.Printf("Fehler beim Aktualisieren des Agent-Status: %v", err)
	}

	// Client registrieren
	m.clientsLock.Lock()
	// Bestehende Verbindung schließen, falls vorhanden
	if existingClient, ok := m.clients[agentID]; ok {
		existingClient.conn.Close()
	}
	m.clients[agentID] = client
	m.clientsLock.Unlock()

	m.logger.Printf("Agent %d verbunden", agentID)

	// Client-Goroutinen starten
	go client.readPump(m)
	go client.writePump()
}

// IsConnected prüft, ob ein Agent aktuell verbunden ist
func (m *Manager) IsConnected(agentID int) bool {
	m.clientsLock.RLock()
	_, ok := m.clients[agentID]
	m.clientsLock.RUnlock()
	return ok
}

// SendToAgent sendet eine Nachricht an einen bestimmten Agenten
func (m *Manager) SendToAgent(agentID int, message interface{}) error {
	data, err := json.Marshal(message)
	if err != nil {
		return err
	}

	m.clientsLock.RLock()
	client, ok := m.clients[agentID]
	m.clientsLock.RUnlock()

	if !ok {
		return common.ErrAgentNotConnected
	}

	select {
	case client.send <- data:
		return nil
	default:
		// Wenn der Kanal voll ist, schließen wir die Verbindung
		return common.ErrAgentChannelFull
	}
}

// readPump liest Nachrichten vom WebSocket
func (c *Client) readPump(m *Manager) {
	defer func() {
		m.clientsLock.Lock()
		delete(m.clients, c.agentID)
		m.clientsLock.Unlock()

		// Agent als offline markieren
		ctx := context.Background()
		if err := m.agents.UpdateStatus(ctx, c.agentID, "offline"); err != nil {
			m.logger.Printf("Fehler beim Aktualisieren des Agent-Status: %v", err)
		}

		m.logger.Printf("Agent %d getrennt", c.agentID)
		c.conn.Close()
	}()

	c.conn.SetReadLimit(4096)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				m.logger.Printf("Fehler beim Lesen vom WebSocket: %v", err)
			}
			break
		}

		// Nachricht verarbeiten
		var msg Message
		if err := json.Unmarshal(message, &msg); err != nil {
			m.logger.Printf("Fehler beim Parsen der Nachricht: %v", err)
			continue
		}

		// Je nach Nachrichtentyp weiterverarbeiten
		switch msg.Type {
		case MessageTypeHeartbeat:
			// Bei Heartbeat den letzten Sichtbarkeitszeitpunkt aktualisieren
			ctx := context.Background()
			if err := m.agents.UpdateStatus(ctx, c.agentID, "online"); err != nil {
				m.logger.Printf("Fehler beim Aktualisieren des Heartbeats: %v", err)
			}

		case MessageTypeAgentInfo:
			// Agent-Informationen aktualisieren
			var info struct {
				System        string `json:"system"`
				IPAddress     string `json:"ip_address"`
				Version       string `json:"version"`
				TransportMode string `json:"transport_mode"`
			}
			if err := json.Unmarshal(msg.Data, &info); err != nil {
				m.logger.Printf("Fehler beim Parsen der Agent-Info: %v", err)
				continue
			}

			// Agent-Informationen in der Datenbank speichern
			ctx := context.Background()
			if err := m.agents.UpdateInfo(ctx, c.agentID, info.System, info.IPAddress, info.Version); err != nil {
				m.logger.Printf("Fehler beim Aktualisieren der Agent-Info: %v", err)
			} else {
				m.logger.Printf("Agent %d Info aktualisiert: system=%s, ip=%s, version=%s", c.agentID, info.System, info.IPAddress, info.Version)
			}

			// Transport-Modus speichern
			transportMode := info.TransportMode
			if transportMode == "" {
				transportMode = "websocket"
			}
			if err := m.agents.UpdateTransportMode(ctx, c.agentID, transportMode); err != nil {
				m.logger.Printf("Fehler beim Aktualisieren des Transport-Modus: %v", err)
			}

		case MessageTypeTransferProgress:
			// Fortschritt eines Transfers aktualisieren
			var progress struct {
				TransferID json.RawMessage `json:"transfer_id"`
				Progress   float64         `json:"progress"`
			}
			if err := json.Unmarshal(msg.Data, &progress); err != nil {
				m.logger.Printf("Fehler beim Parsen des Transfer-Fortschritts: %v", err)
				continue
			}

			transferID := parseTransferID(progress.TransferID)
			if transferID <= 0 {
				m.logger.Printf("Ungueltige Transfer-ID im Fortschritt")
				continue
			}

			// Transfer als laufend markieren und Fortschritt speichern
			ctx := context.Background()
			if err := m.transfers.UpdateProgress(ctx, transferID, progress.Progress); err != nil {
				m.logger.Printf("Fehler beim Aktualisieren des Transfer-Fortschritts: %v", err)
			} else {
				m.logger.Printf("Transfer %d Fortschritt: %.1f%%", transferID, progress.Progress*100)
			}

		case MessageTypeTransferComplete:
			// Transfer als abgeschlossen markieren
			var complete struct {
				TransferID json.RawMessage `json:"transfer_id"`
			}
			if err := json.Unmarshal(msg.Data, &complete); err != nil {
				m.logger.Printf("Fehler beim Parsen der Transfer-Fertigstellung: %v", err)
				continue
			}

			transferID := parseTransferID(complete.TransferID)
			if transferID <= 0 {
				m.logger.Printf("Ungueltige Transfer-ID in Fertigstellung")
				continue
			}

			ctx := context.Background()

			// Pruefen ob dies die Upload-Phase war (Quell-Agent meldet fertig)
			// → Phase 2: Download an Ziel-Agent dispatchen
			if m.transferGetter != nil {
				t, err := m.transferGetter.GetByID(ctx, transferID)
				if err == nil && t.DestinationAgentID != nil && t.SourceAgentID != nil && c.agentID == *t.SourceAgentID {
					// Upload-Phase fertig — sende Download-Request an Ziel-Agent
					m.logger.Printf("Transfer %d Upload abgeschlossen, dispatche Download an Agent %d", transferID, *t.DestinationAgentID)

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

					// Transfer-Status auf running setzen (Phase 2)
					m.transfers.UpdateStatus(ctx, transferID, "running", "")

					if err := m.SendToAgent(*t.DestinationAgentID, downloadMsg); err != nil {
						m.logger.Printf("Fehler beim Dispatchen des Downloads an Agent %d: %v", *t.DestinationAgentID, err)
						m.transfers.UpdateStatus(ctx, transferID, "failed", "destination agent not connected")
					}
					continue
				}
			}

			// Ziel-Agent (oder kein Ziel) — Transfer endgueltig abschliessen
			if err := m.transfers.UpdateStatus(ctx, transferID, "completed", ""); err != nil {
				m.logger.Printf("Fehler beim Abschließen des Transfers %d: %v", transferID, err)
			} else {
				m.logger.Printf("Transfer %d abgeschlossen", transferID)
			}

		case MessageTypeTransferError:
			// Fehlermeldung für einen Transfer
			var errorMsg struct {
				TransferID json.RawMessage `json:"transfer_id"`
				Error      string          `json:"error"`
			}
			if err := json.Unmarshal(msg.Data, &errorMsg); err != nil {
				m.logger.Printf("Fehler beim Parsen des Transfer-Fehlers: %v", err)
				continue
			}

			transferID := parseTransferID(errorMsg.TransferID)
			if transferID <= 0 {
				m.logger.Printf("Ungueltige Transfer-ID im Fehler")
				continue
			}

			// Transfer als fehlgeschlagen in der Datenbank markieren
			ctx := context.Background()
			if err := m.transfers.UpdateStatus(ctx, transferID, "failed", errorMsg.Error); err != nil {
				m.logger.Printf("Fehler beim Markieren des Transfer-Fehlers %d: %v", transferID, err)
			} else {
				m.logger.Printf("Transfer %d fehlgeschlagen: %s", transferID, errorMsg.Error)
			}

		default:
			m.logger.Printf("Unbekannter Nachrichtentyp: %s", msg.Type)
		}
	}
}

// writePump schreibt Nachrichten in den WebSocket
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				// Kanal geschlossen
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			// Jede Nachricht als eigenen WebSocket-Frame senden,
			// damit jeder Frame gültiges JSON bleibt.
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}
		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

// parseTransferID parst eine Transfer-ID aus json.RawMessage (kann int oder string sein).
func parseTransferID(raw json.RawMessage) int {
	// Versuche als int
	var intID int
	if err := json.Unmarshal(raw, &intID); err == nil {
		return intID
	}
	// Versuche als string
	var strID string
	if err := json.Unmarshal(raw, &strID); err == nil {
		id, _ := strconv.Atoi(strID)
		return id
	}
	return 0
}
