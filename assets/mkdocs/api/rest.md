---
title: "REST Endpoints"
weight: 1
---
# REST API Endpoints

Base URL: `http://localhost:3001/api/v1`

All endpoints require `Authorization: Bearer <token>` unless noted.

## Authentication

### POST /auth/login
Login and receive a JWT token.

**Request:**
```json
{ "email": "admin@fileflux.de", "password": "admin123" }
```

**Response:**
```json
{ "token": "eyJhbG...", "user": { "id": 1, "email": "admin@fileflux.de", "role": "admin" } }
```

### POST /auth/register
Register a new user (admin only).

---

## Agents

### GET /agents
List all agents.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status (`online`, `offline`) |
| `page` | int | Page number (default: 1) |
| `limit` | int | Items per page (default: 20) |

### GET /agents/:id
Get agent details including system info.

### DELETE /agents/:id
Deregister an agent.

---

## Jobs

### GET /jobs
List all jobs.

### GET /jobs/:id
Get job details.

### POST /jobs
Create a new job.

**Request:**
```json
{
  "name": "Daily Report Transfer",
  "type": "push",
  "source_agent_id": 1,
  "source_path": "/data/reports/",
  "dest_agent_id": 2,
  "dest_path": "/incoming/reports/",
  "schedule": "0 6 * * *",
  "file_pattern": "*.csv"
}
```

### PUT /jobs/:id
Update a job.

### DELETE /jobs/:id
Delete a job.

### POST /jobs/:id/run
Trigger immediate job execution.

---

## Transfers

### GET /transfers
List transfers with filtering.

**Query Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `status` | string | Filter by status |
| `job_id` | int | Filter by job |
| `page` | int | Page number |
| `limit` | int | Items per page |

### GET /transfers/:id
Get transfer details.

### POST /transfers/:id/retry
Retry a failed transfer.

### POST /transfers/:id/cancel
Cancel a running transfer.

---

## Tokens

### GET /tokens
List all tokens.

### POST /tokens
Create a new agent token.

**Request:**
```json
{ "name": "agent-prod-01", "expires_at": "2025-12-31T23:59:59Z" }
```

**Response:**
```json
{ "id": 1, "name": "agent-prod-01", "token": "ffx_abc123...", "expires_at": "2025-12-31T23:59:59Z" }
```

### DELETE /tokens/:id
Revoke a token.

---

## Health

### GET /health
Health check (no auth required).

**Response:**
```json
{ "status": "healthy", "version": "1.0.0", "uptime": "2h 15m" }
```

## Error Format

All errors follow a consistent format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "source_agent_id is required",
    "details": { "field": "source_agent_id" }
  }
}
```

| HTTP Status | Code | Description |
|-------------|------|-------------|
| 400 | `VALIDATION_ERROR` | Invalid request body |
| 401 | `UNAUTHORIZED` | Missing or invalid token |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 404 | `NOT_FOUND` | Resource not found |
| 409 | `CONFLICT` | Resource already exists |
| 500 | `INTERNAL_ERROR` | Server error |
