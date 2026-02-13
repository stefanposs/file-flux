---
title: "WebSocket Protocol"
weight: 6
---
# WebSocket Protocol

The WebSocket protocol defines communication between agents and the backend.

## Connection

Agents connect to the WebSocket server on port 3002. Authentication is via HTTP `Authorization` header during the WebSocket upgrade:

```
GET ws(s)://host:3002/ws/agent
Authorization: Bearer YOUR_AGENT_TOKEN
```

## Message Format

All control messages use JSON text frames:

```json
{
  "type": "message_type",
  "payload": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

File chunks use binary WebSocket frames with a **57-byte header**:

| Offset | Size | Field |
|--------|------|-------|
| 0 | 4 bytes | Magic (`0x46465846` = "FFXF") |
| 4 | 4 bytes | Transfer ID (uint32, big-endian) |
| 8 | 4 bytes | Chunk index (uint32, big-endian) |
| 12 | 4 bytes | Total chunks (uint32, big-endian) |
| 16 | 32 bytes | Chunk SHA-256 hash (raw bytes) |
| 48 | 4 bytes | Uncompressed size (uint32, big-endian) |
| 52 | 4 bytes | Compressed size (uint32, big-endian) |
| 56 | 1 byte | Compression type (0=none, 1=zstd, 2=LZ4) |
| 57+ | variable | Compressed chunk data |

## Message Types

### Agent → Backend

| Type | Description | Payload |
|------|-------------|---------|
| `heartbeat` | Keep-alive ping | `{ uptime: number }` |
| `agent_info` | System metrics | `{ hostname, os, arch, ip, version }` |
| `transfer_progress` | Progress update | `{ transfer_id, progress, bytes_sent, total_bytes }` |
| `transfer_complete` | Transfer finished | `{ transfer_id, file_hash }` |
| `transfer_error` | Transfer failed | `{ transfer_id, error }` |
| `chunk_ack` | Chunk received OK | `{ transfer_id, chunk_index }` |
| `chunk_nack` | Chunk failed | `{ transfer_id, chunk_index, error }` |

### Backend → Agent

| Type | Description | Payload |
|------|-------------|---------|
| `transfer_request` | Begin transfer | `{ id, job_id, filename, size, source_path, destination_path, protocol, compression }` |
| `cancel_transfer` | Abort transfer | `{ transfer_id }` |
| `transfer_resume` | Resume transfer | `{ transfer_id, from_chunk }` |
| `chunk_request` | Request chunk | `{ transfer_id, chunk_index }` |
| `connection_test` | Connectivity test | `{}` |

!!! note "No AUTH Messages"
    Authentication happens during the WebSocket upgrade via the HTTP `Authorization: Bearer` header — not as a separate WebSocket message.

!!! tip "HTTPS Alternative"
    All message types listed here are also available via the **HTTPS Long-Polling** API (`POST /api/agent/messages` and `GET /api/agent/poll`). Agents behind firewalls that block WebSocket use this transport transparently — see [Agent Architecture](agent.md) for details.

## Heartbeat

Agents send a `heartbeat` every **60 seconds** (configurable via `connection.heartbeat_interval`). If the backend receives no heartbeat or pong for ~60 seconds, the agent is marked as offline.

## Reconnection

On connection loss, the agent uses exponential backoff with jitter:

| Parameter | Value |
|-----------|-------|
| Base delay | 10 seconds (configurable) |
| Maximum backoff | 5 minutes |
| Strategy | Exponential with jitter |
| Max attempts | 5 (configurable, 0 = unlimited) |
