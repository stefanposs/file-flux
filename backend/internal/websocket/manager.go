package websocket

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
	"github.com/stefanposs/file-flux/backend/domain/common"
)

// AgentStatusUpdater defines the agent status operations the WS manager needs.
type AgentStatusUpdater interface {
	UpdateStatus(ctx context.Context, id int, status string) error
}

// TokenValidator defines the token validation operation the WS manager needs.
type TokenValidator interface {
	Validate(ctx context.Context, tokenValue string) (agentID int, err error)
}

// Manager verwaltet WebSocket-Verbindungen zu Agenten
type Manager struct {
	clients     map[int]*Client
	clientsLock sync.RWMutex
	agents      AgentStatusUpdater
	tokens      TokenValidator
	logger      *log.Logger
	upgrader    websocket.Upgrader
}

// Client repräsentiert eine WebSocket-Verbindung zu einem Agenten
type Client struct {
	conn    *websocket.Conn
	agentID int
	send    chan []byte
}

// NewManager erstellt einen neuen WebSocket-Manager
func NewManager(logger *log.Logger, agents AgentStatusUpdater, tokens TokenValidator) *Manager {
	return &Manager{
		clients: make(map[int]*Client),
		agents:  agents,
		tokens:  tokens,
		logger:  logger,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true // In Produktion sollte dies restriktiver sein
			},
		},
	}
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
				System    string `json:"system"`
				IPAddress string `json:"ip_address"`
				Version   string `json:"version"`
			}
			if err := json.Unmarshal(msg.Data, &info); err != nil {
				m.logger.Printf("Fehler beim Parsen der Agent-Info: %v", err)
				continue
			}

			// TODO: Update des Agenten in der Datenbank

		case MessageTypeTransferProgress:
			// Fortschritt eines Transfers aktualisieren
			var progress struct {
				TransferID string  `json:"transfer_id"`
				Progress   float64 `json:"progress"`
			}
			if err := json.Unmarshal(msg.Data, &progress); err != nil {
				m.logger.Printf("Fehler beim Parsen des Transfer-Fortschritts: %v", err)
				continue
			}

			// TODO: Update des Transfers in der Datenbank

		case MessageTypeTransferComplete:
			// Transfer als abgeschlossen markieren
			var complete struct {
				TransferID string `json:"transfer_id"`
			}
			if err := json.Unmarshal(msg.Data, &complete); err != nil {
				m.logger.Printf("Fehler beim Parsen der Transfer-Fertigstellung: %v", err)
				continue
			}

			// TODO: Transfer als abgeschlossen markieren

		case MessageTypeTransferError:
			// Fehlermeldung für einen Transfer
			var errorMsg struct {
				TransferID string `json:"transfer_id"`
				Error      string `json:"error"`
			}
			if err := json.Unmarshal(msg.Data, &errorMsg); err != nil {
				m.logger.Printf("Fehler beim Parsen des Transfer-Fehlers: %v", err)
				continue
			}

			// TODO: Transfer als fehlgeschlagen markieren

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

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Nachricht aus dem Kanal warten
			n := len(c.send)
			for i := 0; i < n; i++ {
				w.Write(<-c.send)
			}

			if err := w.Close(); err != nil {
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
