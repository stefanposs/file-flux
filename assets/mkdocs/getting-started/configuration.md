---
title: "Configuration"
weight: 3
---
# Configuration

FileFlux wird über YAML-Dateien und Umgebungsvariablen konfiguriert.
Umgebungsvariablen überschreiben YAML-Einstellungen.

!!! tip "Vollständige Referenz"
    Die komplette Liste aller Umgebungsvariablen finden Sie unter
    [Deployment → Environment Variables](../deployment/env-vars.md).

## Konfigurationsdateien

### Backend — `config.yaml`

Das Backend lädt seine Konfiguration aus `config.yaml` im Arbeitsverzeichnis.
Die wichtigsten Einstellungen:

```yaml
server:
  host: 0.0.0.0
  port: 3001
  websocket_port: 3002
  storage_dir: /app/storage

database:
  host: localhost
  port: 5432
  user: fileflux
  password: fileflux
  database: fileflux
  sslmode: disable

auth:
  jwt_secret: "min-32-char-secret"   # HS256
  token_expires_in: 24               # Stunden

logging:
  level: info
  file: fileflux.log
```

Jede YAML-Einstellung kann per Umgebungsvariable überschrieben werden —
Details in der [Variablen-Referenz](../deployment/env-vars.md#backend).

### Agent — `config.yaml`

Der Agent liest `config.yaml` aus seinem Arbeitsverzeichnis:

```yaml
agent:
  name: "FileFlux-Agent"
  type: "client"                    # "server" oder "client"
  description: "Mein Agent"

connection:
  server_url: ws://localhost:3002/ws/agent
  server_http_url: http://localhost:3001
  token: "your-agent-token"
  heartbeat_interval: 60            # Sekunden
  reconnect_attempts: 5             # 0 = unbegrenzt
  reconnect_delay: 10               # Sekunden
  transport_mode: "auto"            # "auto", "websocket" oder "polling"
  poll_timeout: 30                  # Long-Poll Timeout in Sekunden
  ws_probe_interval: 300            # WebSocket-Probe-Intervall (Sekunden)

transfers:
  chunk_size: 8                     # MB
  concurrent_transfers: 3
  compression: true
  temp_dir: /tmp/fileflux
  base_dir: /var/lib/fileflux/data

logging:
  level: info
  file: fileflux-agent.log
  max_size: 10                      # MB
  max_backups: 3
  max_age: 7                        # Tage
```

Alle Werte lassen sich auch per Umgebungsvariablen setzen —
Details in der [Variablen-Referenz](../deployment/env-vars.md#agent).

---

## Schnellstart mit Docker Compose

Erstellen Sie eine `.env`-Datei im Projektverzeichnis:

```env
# .env
POSTGRES_USER=fileflux
POSTGRES_PASSWORD=secure-password-here
POSTGRES_DB=fileflux

JWT_SECRET=your-32-char-minimum-jwt-secret-here
INITIAL_ADMIN_PASSWORD=change-me-in-production
```

!!! warning "Standard-Passwort"
    Das initiale Admin-Passwort ist `admin123`.
    Ändern Sie es sofort nach der Installation über die [Einstellungsseite](../guide/settings.md)
    oder per API (`POST /auth/password`).

---

## Nächste Schritte

- [Quick Start](quick-start.md) — Ersten Transfer durchführen
- [Environment Variables](../deployment/env-vars.md) — Vollständige Variablen-Referenz
- [Production](../deployment/production.md) — Produktions-Härtung
