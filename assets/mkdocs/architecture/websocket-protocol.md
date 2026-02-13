---
title: "WebSocket Protocol"
weight: 6
---
# WebSocket Protocol

The WebSocket protocol defines communication between agents and the backend.

## Connection

Agents connect to `ws(s)://host:3002/ws` with a token in the query string:

```
wss://fileflux.example.com:3002/ws?token=YOUR_AGENT_TOKEN
```

## Message Format

All control messages use JSON:

```json
{
  "type": "message_type",
  "payload": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

File chunks use binary WebSocket frames with a 24-byte header:

| Offset | Size | Field |
|--------|------|-------|
| 0 | 8 bytes | Transfer ID (uint64, big-endian) |
| 8 | 4 bytes | Chunk index (uint32, big-endian) |
| 12 | 4 bytes | Chunk size (uint32, big-endian) |
| 16 | 4 bytes | Total chunks (uint32, big-endian) |
| 20 | 4 bytes | Reserved |
| 24+ | variable | Chunk data |

## Message Types

### Agent → Backend

| Type | Description | Payload |
|------|-------------|---------|
| `AUTH` | Authentication | `{ token: string }` |
| `HEARTBEAT` | Keep-alive ping | `{ uptime: number }` |
| `SYSTEM_INFO` | System metrics | `{ hostname, os, arch, cpu, memory, disk }` |
| `CHUNK_ACK` | Chunk received | `{ transfer_id, chunk_index }` |
| `TRANSFER_COMPLETE` | Transfer finished | `{ transfer_id, checksum }` |
| `TRANSFER_ERROR` | Transfer failed | `{ transfer_id, error }` |

### Backend → Agent

| Type | Description | Payload |
|------|-------------|---------|
| `AUTH_OK` | Auth successful | `{ agent_id }` |
| `AUTH_FAIL` | Auth failed | `{ reason }` |
| `TRANSFER_START` | Begin transfer | `{ transfer_id, job_id, filename, size, dest_path }` |
| `TRANSFER_CANCEL` | Abort transfer | `{ transfer_id }` |
| `HEARTBEAT_ACK` | Pong | `{}` |

## Heartbeat

Agents send `HEARTBEAT` every 30 seconds. If the backend receives no heartbeat for 90 seconds, the agent is marked as offline.

## Reconnection

On connection loss, agents use exponential backoff:

| Attempt | Delay |
|---------|-------|
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5+ | 30s (max) |
