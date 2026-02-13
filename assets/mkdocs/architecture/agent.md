---
title: "Agent"
weight: 4
---
# Agent Architecture

The FileFlux agent is a standalone Go binary that runs on endpoint machines.

## Component Structure

```
agent/
├── cmd/agent/main.go       # Entry point, signal handling
├── internal/
│   ├── config/             # YAML configuration (config.go)
│   ├── websocket/          # WebSocket client, reconnect logic
│   ├── transfer/           # File upload/download, chunking
│   ├── api/                # HTTP client for file transfer API
│   └── system/             # System info collection (OS, IP, hostname)
└── go.mod
```

## Startup Flow

```
main.go
  ├── config.LoadConfig()         # YAML laden
  ├── system.CollectSystemInfo()  # OS, Hostname, IP
  ├── api.NewClient()             # HTTP-Client für File-API
  ├── transfer.NewManager()       # Transfer-Engine
  ├── websocket.NewClient()       # WS-Client erstellen
  │     ├── SetSystemInfo()
  │     └── SetTransferManager()
  └── go wsClient.Connect()       # Verbindung in Goroutine
```

## Connection Management

```mermaid
stateDiagram-v2
    [*] --> Connecting
    Connecting --> Connected: WebSocket open
    Connecting --> Backoff: Connection failed
    Backoff --> Connecting: Exponential retry (2s → 5min)
    Connected --> Authenticated: Token validated
    Authenticated --> Ready: System info sent
    Ready --> Ready: Heartbeat loop
    Ready --> Transferring: Transfer command
    Transferring --> Ready: Transfer complete
    Ready --> Reconnecting: Connection lost
    Reconnecting --> Connecting: Backoff + jitter
```

Der Agent nutzt **unbegrenztes exponentielles Backoff mit Jitter** (2 Sekunden bis maximal 5 Minuten) und startet sich nach Verbindungsverlust automatisch neu.

## Transfer Engine

1. **Chunk-basiert** — Dateien werden in konfigurierbaren Chunks gelesen (Standard 1 MB)
2. **HTTP-Upload** — Chunks werden als `PUT /api/files/{transferId}/upload` an den Server gesendet
3. **HTTP-Download** — Dateien werden via `GET /api/files/{transferId}/download` empfangen
4. **Progress-Reporting** — Fortschritt wird per WebSocket an den Server gemeldet
5. **Concurrency** — Mehrere Transfers können parallel laufen (konfigurierbar)

## Message Types

Der Agent verarbeitet folgende WebSocket-Nachrichten:

| Type | Richtung | Beschreibung |
|------|----------|-------------|
| `heartbeat` | Agent → Server | Regelmäßiger Lebenszeichen-Ping |
| `agent_info` | Agent → Server | Systeminformationen senden |
| `transfer_request` | Server → Agent | Transfer starten |
| `transfer_progress` | Agent → Server | Fortschritt melden |
| `transfer_complete` | Agent → Server | Transfer abgeschlossen |
| `transfer_error` | Agent → Server | Fehler melden |

## Cross-Platform Support

Der Agent kompiliert zu einem einzelnen statischen Binary pro Plattform:

| Target | Binary |
|--------|--------|
| Linux amd64 | `fileflux-agent-linux-amd64` |
| Linux arm64 | `fileflux-agent-linux-arm64` |
| macOS amd64 | `fileflux-agent-darwin-amd64` |
| macOS arm64 | `fileflux-agent-darwin-arm64` |
| Windows amd64 | `fileflux-agent-windows-amd64.exe` |
