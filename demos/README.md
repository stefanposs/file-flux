# FileFlux — E2E Demo-Skripte

Interaktive Demo-Skripte für Kunden-Präsentationen. Jedes Skript zeigt einen
kompletten Use-Case vom Login bis zum fertigen Transfer.

## Voraussetzungen

```bash
# Stack starten
just dev
# oder:
docker compose up -d

# Warten bis healthy
docker compose ps
```

| Service   | URL                          |
|-----------|------------------------------|
| Frontend  | http://localhost:3000         |
| API       | http://localhost:3001         |
| WebSocket | ws://localhost:3002/ws/agent  |

**Login:** `admin@fileflux.de` / `admin123`

**Benötigt:** `curl`, `jq`, `bash`

## Demo-Skripte

| # | Skript                     | Szenario                                | Dauer  |
|---|----------------------------|-----------------------------------------|--------|
| 1 | `01-simple-transfer.sh`    | File-Transfer Agent A → Agent B         | ~2 min |
| 2 | `02-scheduled-transfer.sh` | Automatisierter Cron-Transfer           | ~3 min |
| 3 | `03-polling-fallback.sh`   | WebSocket → HTTP Long-Polling Fallback  | ~2 min |

## Ausführung

```bash
cd demos/
chmod +x *.sh

# Demo 1: Einfacher Transfer zwischen zwei Standorten
./01-simple-transfer.sh

# Demo 2: Automatisierte Backups per Cron-Schedule
./02-scheduled-transfer.sh

# Demo 3: Enterprise-Fallback wenn WebSocket blockiert ist
./03-polling-fallback.sh
```

## Tipps für die Präsentation

- **Frontend parallel öffnen** (http://localhost:3000) — zeigt UI live
- **Agents starten** für echte Transfers:
  ```bash
  # Terminal 1: Agent A
  CONNECTION_TOKEN=<token-a> AGENT_NAME=Berlin ./fileflux-agent

  # Terminal 2: Agent B  
  CONNECTION_TOKEN=<token-b> AGENT_NAME=München ./fileflux-agent
  ```
- **Polling-Demo**: Agent mit `CONNECTION_TRANSPORT_MODE=polling` starten
- Skripte pausieren mit ENTER — gibt Zeit für Erklärungen
- `API_URL` überschreiben falls Backend nicht auf localhost läuft:
  ```bash
  API_URL=https://demo.fileflux.de ./01-simple-transfer.sh
  ```

## Nach der Demo

```bash
just down        # Services stoppen
just down-clean  # + Volumes löschen (komplettes Reset)
```
