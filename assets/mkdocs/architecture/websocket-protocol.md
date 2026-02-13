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

!!! note "Keine AUTH-Nachrichten"
    Die Authentifizierung erfolgt beim WebSocket-Upgrade über den HTTP `Authorization: Bearer` Header — nicht als separate WebSocket-Nachricht.

## Heartbeat

Agents senden `heartbeat` alle **60 Sekunden** (konfigurierbar über `connection.heartbeat_interval`). Wenn der Backend für ~60 Sekunden keinen Heartbeat oder Pong empfängt, wird der Agent als offline markiert.

## Reconnection

Bei Verbindungsverlust nutzt der Agent exponentielles Backoff mit Jitter:

| Parameter | Wert |
|-----------|------|
| Basis-Delay | 10 Sekunden (konfigurierbar) |
| Maximales Backoff | 5 Minuten |
| Strategie | Exponentiell mit Jitter |
| Max. Versuche | 5 (konfigurierbar, 0 = unbegrenzt) |
