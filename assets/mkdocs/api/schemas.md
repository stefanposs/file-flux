---
title: "Schemas"
weight: 3
---
# API Schemas

JSON schemas for all API request/response objects.

## User

```json
{
  "id": 1,
  "email": "admin@fileflux.de",
  "name": "Admin",
  "role": "admin",
  "last_login": "2024-01-15T10:00:00Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Agent

```json
{
  "id": 1,
  "name": "prod-server-01",
  "type": "server",
  "status": "online",
  "ip_address": "192.168.1.100",
  "system": "Linux x86_64",
  "version": "1.0.0",
  "description": "Primary upload server",
  "transport_mode": "websocket",
  "last_seen": "2024-01-15T10:30:00Z",
  "last_poll_at": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

Valid agent types: `"server"`, `"client"`.

## Job

```json
{
  "id": 1,
  "name": "Daily Report Transfer",
  "type": "push",
  "status": "active",
  "source_agent_id": 1,
  "source_path": "/data/reports/",
  "destination_agent_id": 2,
  "destination_path": "/incoming/reports/",
  "schedule": "0 0 6 * * *",
  "description": "Transfer daily reports to backup server",
  "last_run": "2024-01-15T06:00:00Z",
  "user_id": 1,
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Transfer

```json
{
  "id": 1,
  "job_id": 1,
  "filename": "report-2024-01-15.csv",
  "size": 1048576,
  "status": "completed",
  "source_agent_id": 1,
  "destination_agent_id": 2,
  "source_path": "/data/reports/report.csv",
  "destination_path": "/incoming/report.csv",
  "checksum": "sha256:a1b2c3d4e5f6...",
  "progress": 100.0,
  "start_time": "2024-01-15T06:00:01Z",
  "end_time": "2024-01-15T06:00:05Z",
  "error": null,
  "file_hash": "a1b2c3d4e5f6...",
  "compression": "zstd",
  "chunk_size": 8388608,
  "total_chunks": 1,
  "completed_chunks": 1,
  "bytes_transferred": 1048576,
  "retry_count": 0,
  "max_retries": 3
}
```

## Token

```json
{
  "id": 1,
  "name": "agent-prod-01",
  "agent_id": 1,
  "description": "Production agent token",
  "expires_at": "2025-12-31T23:59:59Z",
  "last_used": "2024-01-15T08:00:00Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

!!! note "Kein Pagination-Wrapper"
    List-Endpoints geben aktuell direkt ein Array zurück. Serverseitige Pagination ist für eine zukünftige Version geplant.
