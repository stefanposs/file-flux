# FileFlux

Scalable managed file transfer platform for streaming data between legacy systems, on-prem servers, and cloud storage.

## Architecture

| Component   | Tech                      | Port  |
|-------------|---------------------------|-------|
| **Backend** | Go 1.22 · Clean Arch      | 3001 (HTTP) / 3002 (WS) |
| **Frontend**| Lit 2.6 · TypeScript · Vite | 3000 |
| **Agent**   | Go 1.22 · WebSocket client | 8080 |
| **Database**| PostgreSQL 16             | 5432  |
| **Docs**    | MkDocs Material           | 8001  |

## Quick Start

```bash
# 1. Clone & enter
git clone https://github.com/stefanposs/file-flux.git
cd file-flux

# 2. Copy environment file
cp .env.example .env

# 3. Start everything with Docker Compose
docker compose up -d --build

# 4. Open the dashboard
open http://localhost:3000
```

### Default Credentials

| Service   | Email / User        | Password   |
|-----------|---------------------|------------|
| Dashboard | admin@fileflux.de   | admin123   |

## Development (with just)

Requires [just](https://github.com/casey/just), Go 1.22+, Node.js 20+, Docker, and Python 3.10+.

```bash
just setup          # install all dependencies
just dev            # start Docker Compose dev environment
just build          # build all binaries
just test           # run all tests
just lint           # lint all components
just docs           # serve MkDocs locally at localhost:8001
just docs-build     # build static docs site
just clean          # remove build artifacts
```

## Project Structure

```
file-flux/
├── backend/          # Go REST API + WebSocket server
│   ├── cmd/server/   # Entrypoint
│   ├── internal/     # Handlers, models, DB, auth, WebSocket
│   └── Dockerfile
├── frontend/         # Lit web components + Vite
│   ├── src/          # TypeScript components
│   └── Dockerfile
├── agent/            # Go agent (connects via WebSocket)
│   ├── cmd/agent/    # Entrypoint
│   ├── internal/     # Config, transfer, WebSocket client
│   └── Dockerfile
├── docs/             # MkDocs documentation source
├── .github/workflows/ # CI/CD (GitHub Actions)
├── docker-compose.yml
├── justfile          # Task runner
└── mkdocs.yml        # Documentation config
```

## Documentation

Full documentation is built with [MkDocs Material](https://squidfunk.github.io/mkdocs-material/).

```bash
# Serve locally
just docs

# Or manually
pip install -r requirements-docs.txt
mkdocs serve -a localhost:8001
```

## Environment Variables

See [.env.example](.env.example) for all available configuration options.

Key variables:

| Variable       | Description                          | Default              |
|----------------|--------------------------------------|----------------------|
| DB_USER        | PostgreSQL user                      | fileflux             |
| DB_PASSWORD    | PostgreSQL password                  | (required)           |
| JWT_SECRET     | Secret for JWT token signing         | (required)           |
| AGENT_TOKEN    | Token for agent WebSocket auth       | demo-agent-secret-token (dev) |
| LOG_LEVEL      | Log verbosity                        | info                 |

## License

MIT
