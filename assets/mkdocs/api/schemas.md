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
  "role": "admin",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Agent

```json
{
  "id": 1,
  "name": "prod-server-01",
  "type": "endpoint",
  "status": "online",
  "ip_address": "192.168.1.100",
  "system_info": {
    "hostname": "prod-server-01",
    "os": "linux",
    "arch": "amd64",
    "cpu_count": 8,
    "memory_total": 17179869184,
    "memory_available": 8589934592,
    "disk_total": 107374182400,
    "disk_available": 53687091200
  },
  "version": "1.0.0",
  "last_seen": "2024-01-15T10:30:00Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Job

```json
{
  "id": 1,
  "name": "Daily Report Transfer",
  "type": "push",
  "status": "active",
  "source_agent_id": 1,
  "source_agent_name": "prod-server-01",
  "source_path": "/data/reports/",
  "dest_agent_id": 2,
  "dest_agent_name": "backup-server-01",
  "dest_path": "/incoming/reports/",
  "schedule": "0 6 * * *",
  "file_pattern": "*.csv",
  "description": "Transfer daily reports to backup server",
  "last_run_at": "2024-01-15T06:00:00Z",
  "created_by": 1,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-15T06:00:00Z"
}
```

## Transfer

```json
{
  "id": 1,
  "job_id": 1,
  "job_name": "Daily Report Transfer",
  "filename": "report-2024-01-15.csv",
  "size": 1048576,
  "status": "completed",
  "source_agent_id": 1,
  "source_agent_name": "prod-server-01",
  "dest_agent_id": 2,
  "dest_agent_name": "backup-server-01",
  "checksum": "sha256:a1b2c3d4e5f6...",
  "progress": 100.0,
  "started_at": "2024-01-15T06:00:01Z",
  "completed_at": "2024-01-15T06:00:05Z",
  "error": null
}
```

## Token

```json
{
  "id": 1,
  "name": "agent-prod-01",
  "status": "active",
  "agent_id": 1,
  "created_by": 1,
  "expires_at": "2025-12-31T23:59:59Z",
  "created_at": "2024-01-01T00:00:00Z"
}
```

## Pagination

All list endpoints return paginated results:

```json
{
  "data": [ ... ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 150,
    "total_pages": 8
  }
}
```
