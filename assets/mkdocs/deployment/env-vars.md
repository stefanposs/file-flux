---
title: "Environment Variables"
weight: 4
---
# Environment Variables

Complete reference of all environment variables for FileFlux components.
Environment variables override YAML configuration values.

## Backend

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Bind address |
| `SERVER_PORT` | `3001` | HTTP API port |
| `WEBSOCKET_PORT` | `3002` | WebSocket port |
| `STORAGE_DIR` | `/app/storage` | File storage directory |
| `LOG_LEVEL` | `info` | Logging level (`debug`, `info`, `warn`, `error`) |
| `LOG_FILE` | `fileflux.log` | Log file path |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `fileflux` | Database user |
| `DB_PASSWORD` | `fileflux` | Database password |
| `DB_NAME` | `fileflux` | Database name |
| `DB_SSLMODE` | `disable` | SSL mode (`disable`, `require`, `verify-full`) |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | JWT signing secret (min. 32 Zeichen) |
| `TOKEN_EXPIRES_IN` | `24` | JWT token expiry in hours |

### Admin

| Variable | Default | Description |
|----------|---------|-------------|
| `INITIAL_ADMIN_EMAIL` | `admin@fileflux.de` | Initial admin email |
| `INITIAL_ADMIN_PASSWORD` | `admin123` | Initial admin password |

---

## Agent

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENT_ID` | *(auto)* | Agent identifier |
| `AGENT_NAME` | `FileFlux-Agent` | Agent display name |
| `AGENT_TYPE` | `client` | Agent type (`server`, `client`) |
| `AGENT_DESCRIPTION` | *(empty)* | Agent description |
| `CONNECTION_SERVER_URL` | `ws://localhost:3002/ws/agent` | Backend WebSocket URL |
| `CONNECTION_TOKEN` | *(required)* | Agent registration token |
| `CONNECTION_HTTP_URL` | `http://localhost:3001` | Backend HTTP URL (for polling fallback) |

!!! note "Agent-Konfiguration"
    Weitere Agent-Einstellungen (chunk_size, concurrent_transfers, compression, transport_mode etc.)
    werden aktuell nur über die `config.yaml` konfiguriert.

---

## Docker Compose

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | `fileflux` | PostgreSQL username |
| `POSTGRES_PASSWORD` | `fileflux` | PostgreSQL password |
| `POSTGRES_DB` | `fileflux` | Database name |
| `COMPOSE_PROJECT_NAME` | `file-flux` | Docker Compose project |
