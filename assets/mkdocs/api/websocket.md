---
title: "WebSocket Messages"
weight: 2
---
# WebSocket API

WebSocket endpoint: `ws(s)://host:3002/ws/agent`

Authentication is done via HTTP header during the WebSocket upgrade:

```
Authorization: Bearer <AGENT_TOKEN>
```

See [WebSocket Protocol](../architecture/websocket-protocol.md) for the full protocol specification.

## Connection Example (Go)

```go
import (
    "net/http"
    "github.com/gorilla/websocket"
)

header := http.Header{}
header.Set("Authorization", "Bearer ffx_abc123...")

conn, _, err := websocket.DefaultDialer.Dial(
    "wss://fileflux.example.com:3002/ws/agent",
    header,
)
if err != nil {
    log.Fatal(err)
}
defer conn.Close()

// Send heartbeat
msg := map[string]interface{}{
    "type":    "heartbeat",
    "payload": map[string]interface{}{"uptime": 3600},
}
conn.WriteJSON(msg)
```

## Message Types

All control messages use JSON text frames. File chunks use binary WebSocket frames.

### Agent → Backend

| Type | Description |
|------|-------------|
| `heartbeat` | Keep-alive ping (every 60s) |
| `agent_info` | System info (hostname, OS, IP) |
| `transfer_progress` | Transfer progress update |
| `transfer_complete` | Transfer finished with checksum |
| `transfer_error` | Transfer failed |
| `chunk_ack` | Binary chunk received OK |
| `chunk_nack` | Binary chunk receive failed |

### Backend → Agent

| Type | Description |
|------|-------------|
| `transfer_request` | Start a transfer (upload/download) |
| `cancel_transfer` | Abort a running transfer |
| `transfer_resume` | Resume a suspended transfer |
| `chunk_request` | Request a specific chunk |
| `connection_test` | Test agent connectivity |

## Real-Time Updates (Frontend)

The frontend receives updates via polling the REST API and an in-app event bus.
WebSocket connections are reserved for agent ↔ backend communication.
