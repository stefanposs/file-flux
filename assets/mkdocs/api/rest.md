---
title: "REST Endpoints"
weight: 1
---
# REST API Endpoints

Base URL: `http://localhost:3001/api`

Alle Endpoints (außer `/auth/login`, `/health` und `/api/info`) erfordern `Authorization: Bearer <jwt-token>`.

---

## Authentication

### POST /auth/login
Login — gibt ein JWT-Token zurück.

**Request:**
```json
{ "email": "admin@fileflux.de", "password": "admin123" }
```

**Response:**
```json
{ "token": "eyJhbG...", "user": { "id": 1, "email": "admin@fileflux.de", "role": "admin" } }
```

### POST /auth/refresh
:material-lock: Erneuert ein JWT-Token.

### GET /auth/user
:material-lock: Gibt den aktuellen Benutzer zurück.

### POST /auth/password
:material-lock: Ändert das Passwort des aktuellen Benutzers.

**Request:**
```json
{ "old_password": "oldpw", "new_password": "newpw" }
```

---

## Agents

### GET /agents
:material-lock: Alle Agenten auflisten.

### POST /agents
:material-shield-lock: Agent erstellen (Admin only).

**Request:**
```json
{ "name": "prod-agent-01", "type": "server", "description": "Primary upload server" }
```

### GET /agents/:id
:material-lock: Agent-Details abrufen.

### PUT /agents/:id
:material-shield-lock: Agent aktualisieren (Admin only).

### DELETE /agents/:id
:material-shield-lock: Agent löschen (Admin only).

### POST /agents/:id/test
:material-shield-lock: Verbindung zum Agent testen (Admin only).

---

## Jobs

### GET /jobs
:material-lock: Alle Jobs des Benutzers auflisten (gefiltert nach `user_id`).

### POST /jobs
:material-lock: Neuen Job erstellen.

**Request:**
```json
{
  "name": "Daily Report Transfer",
  "type": "push",
  "source_agent_id": 1,
  "destination_agent_id": 2,
  "source_path": "/data/reports/",
  "destination_path": "/incoming/reports/",
  "schedule": "0 0 6 * * *",
  "description": "Täglicher Report-Transfer um 06:00"
}
```

### GET /jobs/:id
:material-lock: Job-Details (Ownership-Prüfung — nur eigene Jobs).

### PUT /jobs/:id
:material-lock: Job aktualisieren (Ownership-Prüfung).

### DELETE /jobs/:id
:material-lock: Job löschen (Ownership-Prüfung).

### POST /jobs/:id/run
:material-lock: Job sofort ausführen (Ownership-Prüfung). Erstellt einen neuen Transfer und dispatcht ihn an den Quell-Agenten.

---

## Transfers

### GET /transfers
:material-lock: Alle Transfers des Benutzers auflisten (gefiltert nach `user_id` über Job-Zugehörigkeit).

### POST /transfers
:material-lock: Neuen Transfer erstellen.

**Request:**
```json
{
  "job_id": 1,
  "filename": "report.csv",
  "size": 1048576,
  "source_path": "/data/reports/report.csv",
  "destination_path": "/incoming/report.csv",
  "source_agent_id": 1,
  "destination_agent_id": 2
}
```

### GET /transfers/:id
:material-lock: Transfer-Details (Ownership-Prüfung über Job-Zugehörigkeit).

### POST /transfers/:id/cancel
:material-lock: Laufenden Transfer abbrechen (Ownership-Prüfung).

---

## Tokens

### GET /tokens
:material-lock: Alle Agent-Tokens auflisten.

### POST /tokens
:material-shield-lock: Neues Agent-Token erstellen (Admin only).

**Request:**
```json
{ "name": "agent-prod-01", "agent_id": 1, "description": "Production agent token" }
```

**Response:**
```json
{
  "token": { "id": 1, "name": "agent-prod-01", "agent_id": 1, "created_at": "...", "expires_at": null },
  "value": "ffx_abc123..."
}
```

!!! warning "Token-Wert wird nur einmal angezeigt"
    Der `value` wird nur bei der Erstellung zurückgegeben. Speichern Sie ihn sofort.

### DELETE /tokens/:id
:material-shield-lock: Token widerrufen (Admin only).

---

## File Transfer (Agent-Authentifizierung)

Diese Endpoints nutzen **Agent-Token** (nicht JWT) im `Authorization: Bearer <agent-token>` Header. Sie werden vom Agent für den eigentlichen Dateitransfer verwendet.

### PUT /files/:transferId/upload
:material-key: Datei hochladen.

**Query Parameter:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `filename` | string | `file.dat` | Dateiname |

**Request Body:** Raw file bytes (`application/octet-stream`).

**Limits:** Max 5 GB Upload-Größe.

**Response:**
```json
{ "transfer_id": 1, "filename": "report.csv", "size": 1048576, "agent_id": 3 }
```

### GET /files/:transferId/download
:material-key: Datei herunterladen.

**Response:** Datei als `application/octet-stream` mit `Content-Disposition: attachment`.

---

## Health & Info

### GET /health
Health-Check (keine Authentifizierung). Prüft Datenbank-Konnektivität.

**Response (healthy):**
```json
{ "status": "ok", "version": "1.0.0", "components": { "database": "ok", "api": "ok" } }
```

**Response (unhealthy, HTTP 503):**
```json
{ "status": "degraded", "version": "1.0.0", "components": { "database": "error", "api": "ok" } }
```

### GET /api/info
API-Informationen.

```json
{ "name": "FileFlux API", "version": "1.0.0", "docs": "/api/docs" }
```

---

## Agent Long-Polling (Fallback)

Diese Endpoints werden vom Agent als Fallback-Transport genutzt, wenn keine WebSocket-Verbindung möglich ist.
Authentifizierung erfolgt per `Authorization: Bearer <agent-token>`.

### POST /api/agent/connect
:material-key: Agent-Registrierung über Polling-Transport.

### GET /api/agent/poll
:material-key: Long-Polling — wartet auf neue Nachrichten vom Server.

### POST /api/agent/messages
:material-key: Agent sendet Nachrichten (Heartbeat, Transfer-Status) an den Server.

### POST /api/agent/ack
:material-key: Agent bestätigt den Empfang einer Nachricht.

---

## Error Format

Alle Fehler folgen einem einheitlichen Format:

```json
{ "error": "Beschreibung des Fehlers" }
```

| HTTP Status | Bedeutung |
|-------------|-----------|
| 400 | Ungültige Anfrage / Validierungsfehler |
| 401 | Nicht authentifiziert |
| 403 | Unzureichende Berechtigungen |
| 404 | Ressource nicht gefunden (oder kein Zugriff) |
| 413 | Datei zu groß |
| 429 | Rate Limit überschritten |
| 500 | Interner Serverfehler |

!!! info "IDOR-Schutz"
    Alle Single-Resource-Endpoints (`/jobs/:id`, `/transfers/:id`) prüfen die Besitzverhältnisse.
    Zugriffe auf fremde Ressourcen geben `404 Not Found` zurück — nicht `403` — um keine Informationen über die Existenz von Ressourcen preiszugeben.
