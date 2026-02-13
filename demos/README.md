# FileFlux — E2E Demo Scripts

Interactive demo scripts for customer presentations. Each script demonstrates
a complete use case from login to finished transfer.

## Prerequisites

```bash
# Start the stack
just dev
# or:
docker compose up -d

# Wait until healthy
docker compose ps
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000         |
| API       | http://localhost:3001         |
| WebSocket | ws://localhost:3002/ws/agent  |

**Login:** `admin@fileflux.de` / `admin123`

**Required:** `curl`, `jq`, `bash`

## Demo Scripts

| # | Script                     | Scenario                                | Duration |
|---|----------------------------|-----------------------------------------|----------|
| 1 | `01-simple-transfer.sh`    | File transfer Agent A → Agent B         | ~2 min   |
| 2 | `02-scheduled-transfer.sh` | Automated cron-based transfer           | ~3 min   |
| 3 | `03-polling-fallback.sh`   | WebSocket → HTTP Long-Polling fallback  | ~2 min   |

## Running

```bash
cd demos/
chmod +x *.sh

# Demo 1: Simple transfer between two locations
./01-simple-transfer.sh

# Demo 2: Automated backups via cron schedule
./02-scheduled-transfer.sh

# Demo 3: Enterprise fallback when WebSocket is blocked
./03-polling-fallback.sh
```

## Presentation Tips

- **Open the frontend in parallel** (http://localhost:3000) — shows live UI updates
- **Start agents** for real transfers:
  ```bash
  # Terminal 1: Agent A
  CONNECTION_TOKEN=<token-a> AGENT_NAME=Berlin ./fileflux-agent

  # Terminal 2: Agent B  
  CONNECTION_TOKEN=<token-b> AGENT_NAME=Munich ./fileflux-agent
  ```
- **Polling demo**: Start agent with `CONNECTION_TRANSPORT_MODE=polling`
- Scripts pause on ENTER — gives time for explanations
- Override `API_URL` if the backend is not running on localhost:
  ```bash
  API_URL=https://demo.fileflux.de ./01-simple-transfer.sh
  ```

## After the Demo

```bash
just down        # Stop services
just down-clean  # + Delete volumes (full reset)
```
