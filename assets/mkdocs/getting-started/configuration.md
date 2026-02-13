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
  ws_port: 3002

database:
  host: localhost
  port: 5432
  user: fileflux
  password: fileflux
  name: fileflux
  sslmode: disable

jwt:
  secret: "min-32-char-secret"   # HS256
  expiry: 24h
```

Jede YAML-Einstellung kann per Umgebungsvariable überschrieben werden —
Details in der [Variablen-Referenz](../deployment/env-vars.md#backend).

### Agent — `config.yaml`

Der Agent liest `config.yaml` aus seinem Arbeitsverzeichnis oder `~/.fileflux/config.yaml`:

```yaml
server:
  url: ws://localhost:3002/ws
  token: "your-agent-token"
  reconnect_interval: 5s
  max_reconnect_attempts: 0   # 0 = unbegrenzt

agent:
  name: "agent-01"
  work_dir: /var/lib/fileflux
  upload_dir: /var/lib/fileflux/uploads
  download_dir: /var/lib/fileflux/downloads

transfer:
  chunk_size: 1048576   # 1 MB
  max_concurrent: 4
  checksum_algorithm: sha256

logging:
  level: info    # debug | info | warn | error
  format: json   # json | text
```

Alle Werte lassen sich auch per `FILEFLUX_*`-Variablen setzen —
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
