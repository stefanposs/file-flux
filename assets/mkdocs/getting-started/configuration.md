---
title: "Configuration"
weight: 3
---
# Configuration

FileFlux is configured via YAML files and environment variables. Environment variables override YAML settings.

## Backend Settings

### Server

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `0.0.0.0` | Bind address |
| `SERVER_PORT` | `3001` | HTTP API port |
| `SERVER_WS_PORT` | `3002` | WebSocket port |
| `SERVER_READ_TIMEOUT` | `30s` | HTTP read timeout |
| `SERVER_WRITE_TIMEOUT` | `30s` | HTTP write timeout |

### Database

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `fileflux` | Database user |
| `DB_PASSWORD` | `fileflux` | Database password |
| `DB_NAME` | `fileflux` | Database name |
| `DB_SSLMODE` | `disable` | SSL mode (`disable`, `require`, `verify-full`) |
| `DB_MAX_OPEN_CONNS` | `25` | Max open connections |
| `DB_MAX_IDLE_CONNS` | `5` | Max idle connections |
| `DB_CONN_MAX_LIFETIME` | `5m` | Connection max lifetime |

### Security

| Variable | Default | Description |
|----------|---------|-------------|
| `JWT_SECRET` | *(required)* | JWT signing secret (min 32 chars) |
| `JWT_EXPIRY` | `24h` | Token expiry duration |
| `BCRYPT_COST` | `12` | Password hashing cost |

### Transfers

| Variable | Default | Description |
|----------|---------|-------------|
| `TRANSFER_CHUNK_SIZE` | `1048576` | Chunk size in bytes (default 1 MB) |
| `TRANSFER_MAX_RETRIES` | `3` | Max retry attempts per chunk |
| `TRANSFER_TIMEOUT` | `30m` | Transfer timeout |
| `TRANSFER_TEMP_DIR` | `/tmp/fileflux` | Temporary chunk storage |

### Initial Admin User

| Variable | Default | Description |
|----------|---------|-------------|
| `INITIAL_ADMIN_EMAIL` | `admin@fileflux.de` | Email for the auto-seeded admin |
| `INITIAL_ADMIN_PASSWORD` | `admin123` | Password — **change in production!** |

---

## Agent Settings

The agent reads from `config.yaml` in its working directory or `~/.fileflux/config.yaml`.

```yaml
# agent/config.yaml
server:
  url: ws://localhost:3002/ws
  token: "your-agent-token"
  reconnect_interval: 5s
  max_reconnect_attempts: 0  # 0 = unlimited

agent:
  name: "agent-01"
  work_dir: /var/lib/fileflux
  upload_dir: /var/lib/fileflux/uploads
  download_dir: /var/lib/fileflux/downloads

transfer:
  chunk_size: 1048576  # 1 MB
  max_concurrent: 4
  checksum_algorithm: sha256

logging:
  level: info   # debug, info, warn, error
  format: json  # json, text
```

### Agent Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FILEFLUX_SERVER_URL` | `ws://localhost:3002/ws` | Backend WebSocket URL |
| `FILEFLUX_AGENT_TOKEN` | *(required)* | Agent registration token |
| `FILEFLUX_AGENT_NAME` | hostname | Agent display name |
| `FILEFLUX_WORK_DIR` | `/var/lib/fileflux` | Working directory |
| `FILEFLUX_LOG_LEVEL` | `info` | Log level |

---

## Docker Compose Configuration

Override settings in `.env` or `docker-compose.override.yml`:

```env
# .env
POSTGRES_USER=fileflux
POSTGRES_PASSWORD=secure-password-here
POSTGRES_DB=fileflux

JWT_SECRET=your-32-char-minimum-jwt-secret-here
INITIAL_ADMIN_PASSWORD=change-me-in-production
```

## Next Steps

- [Quick Start](quick-start.md) — Run your first transfer
- [Deployment / Production](../deployment/production.md) — Production hardening guide
