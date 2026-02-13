---
title: "WebSocket Messages"
weight: 2
---
# WebSocket API

WebSocket endpoint: `ws(s)://host:3002/ws?token=AGENT_TOKEN`

See [WebSocket Protocol](../architecture/websocket-protocol.md) for the full protocol specification.

## Connection Example (Go)

```go
import "github.com/gorilla/websocket"

conn, _, err := websocket.DefaultDialer.Dial(
    "wss://fileflux.example.com:3002/ws?token=ffx_abc123",
    nil,
)
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

// Send heartbeat
msg := map[string]interface{}{
    "type":    "HEARTBEAT",
    "payload": map[string]interface{}{"uptime": 3600},
}
conn.WriteJSON(msg)
```

## Server-Sent Events (SSE)

Frontend clients subscribe to real-time updates via SSE:

```
GET /api/v1/events
Accept: text/event-stream
Authorization: Bearer <jwt>
```

### Event Types

| Event | Data | Description |
|-------|------|-------------|
| `transfer.started` | `{ transfer_id, job_id, filename }` | Transfer began |
| `transfer.progress` | `{ transfer_id, progress, speed }` | Progress update |
| `transfer.completed` | `{ transfer_id, checksum, duration }` | Transfer finished |
| `transfer.failed` | `{ transfer_id, error }` | Transfer failed |
| `agent.connected` | `{ agent_id, name }` | Agent came online |
| `agent.disconnected` | `{ agent_id, name }` | Agent went offline |
| `job.started` | `{ job_id, name }` | Job execution began |
| `job.completed` | `{ job_id, transfers_count }` | Job finished |

### JavaScript Example

```javascript
const events = new EventSource('/api/v1/events', {
  headers: { 'Authorization': `Bearer ${token}` }
});

events.addEventListener('transfer.progress', (e) => {
  const data = JSON.parse(e.data);
  console.log(`Transfer ${data.transfer_id}: ${data.progress}%`);
});
```
