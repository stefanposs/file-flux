---
title: "Troubleshooting"
weight: 8
---
# Troubleshooting

Häufige Probleme und deren Lösungen.

## Agent verbindet sich nicht

### Symptom
Agent zeigt `Verbindungsfehler: WebSocket-Dial fehlgeschlagen` im Log.

### Ursachen und Lösungen

=== "Falscher Server-URL"

    Prüfen Sie `config.yaml` des Agents:
    ```yaml
    connection:
      server_url: ws://backend:3002/ws    # Docker
      # server_url: ws://localhost:3002/ws # Lokal
    ```

=== "Ungültiges Token"

    ```bash
    # Token in der Datenbank prüfen
    docker compose exec db psql -U fileflux -c "SELECT id, name, token_value FROM tokens;"
    ```
    Das Token in `config.yaml` muss exakt mit `token_value` übereinstimmen.

=== "Firewall / Netzwerk"

    Port `3002` (WebSocket) muss erreichbar sein:
    ```bash
    # Konnektivität testen
    curl -v http://localhost:3002/
    ```

=== "Docker-Netzwerk"

    Wenn der Agent in Docker läuft, muss er im gleichen Docker-Netzwerk sein:
    ```yaml
    # docker-compose.yml
    services:
      agent:
        networks:
          - fileflux-net
    ```

---

## Transfer hängt bei "pending"

### Symptom
Transfer bleibt im Status `pending` und startet nicht.

### Lösungen

1. **Agent online?** — Prüfen Sie den Agent-Status im Dashboard. Nur `online`-Agenten können Transfers empfangen.

2. **WebSocket-Verbindung aktiv?** — Agent-Log prüfen:
    ```
    AGENT: Verbunden mit ws://backend:3002/ws
    ```

3. **Job korrekt konfiguriert?** — Source- und Destination-Agent müssen existieren und zugewiesen sein:
    ```bash
    curl -H "Authorization: Bearer $TOKEN" http://localhost:3001/api/v1/jobs/1
    ```

4. **Quell-Datei vorhanden?** — Der `source_path` muss auf dem Quell-Agenten existieren.

---

## Transfer schlägt fehl

### Symptom
Transfer wechselt zu Status `failed` mit Fehlermeldung.

### Häufige Fehler

| Fehlermeldung | Ursache | Lösung |
|---------------|---------|--------|
| `file exceeds maximum upload size` | Datei > 5 GB | Datei aufteilen oder Limit anpassen |
| `transfer file not found` | Datei auf Server nicht vorhanden | Upload vom Quell-Agenten prüfen |
| `connection refused` | Ziel-Agent nicht erreichbar | Netzwerk/Firewall prüfen |
| `cancelled by user` | Manuell abgebrochen | Nicht kritisch |

---

## Login funktioniert nicht

### Symptom
`401 Unauthorized` bei der Anmeldung.

### Lösungen

1. **Standard-Zugangsdaten:** `admin@fileflux.de` / `admin123`

2. **Passwort zurücksetzen** (über DB):
    ```bash
    docker compose exec db psql -U fileflux -c "
      UPDATE users SET password_hash = '\$2a\$10\$pYCe9H.DBLyg77sT5d9PruqXEy8ZRlGIt7bGFWA9yHTwcLgGovzJC'
      WHERE email = 'admin@fileflux.de';
    "
    ```
    Dies setzt das Passwort auf `admin123` zurück.

3. **JWT-Secret geändert?** — Nach Änderung des JWT-Secrets werden alle bestehenden Tokens ungültig. Neu einloggen.

---

## Datenbank-Verbindungsfehler

### Symptom
Backend startet nicht: `Fehler beim Verbinden mit der Datenbank`.

### Lösungen

```bash
# PostgreSQL läuft?
docker compose ps db

# Manuell verbinden
docker compose exec db psql -U fileflux -d fileflux

# Logs prüfen
docker compose logs db
```

Prüfen Sie die Datenbank-Konfiguration in `config.yaml`:
```yaml
database:
  host: db          # "db" in Docker, "localhost" lokal
  port: 5432
  user: fileflux
  password: fileflux
  database: fileflux
```

---

## WebSocket über Reverse Proxy

### Symptom
Agenten verbinden sich nicht, wenn ein Nginx/Traefik-Proxy vor dem Backend steht.

### Lösung

WebSocket-Upgrade-Headers müssen weitergeleitet werden:

```nginx
# nginx.conf
location /ws/ {
    proxy_pass http://backend:3002;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 86400;
}
```

---

## Docker Compose startet nicht

### Häufige Probleme

=== "Port bereits belegt"

    ```bash
    # Welcher Prozess nutzt den Port?
    lsof -i :3000    # Frontend
    lsof -i :3001    # Backend HTTP
    lsof -i :3002    # Backend WS
    lsof -i :5432    # PostgreSQL
    ```

=== "Volume-Berechtigungsprobleme"

    ```bash
    # Volumes zurücksetzen
    docker compose down -v
    docker compose up -d
    ```

=== "Build-Cache-Probleme"

    ```bash
    docker compose build --no-cache
    docker compose up -d
    ```

---

## Logs einsehen

```bash
# Alle Services
docker compose logs -f

# Nur Backend
docker compose logs -f backend

# Nur Agent
docker compose logs -f agent-central

# Letzte 100 Zeilen
docker compose logs --tail=100 backend
```

---

## Health-Check nutzen

```bash
# Deep Health Check (prüft DB)
curl http://localhost:3001/health | jq

# Erwartete Antwort bei gesundem System:
# { "status": "healthy", "database": "connected" }
```

!!! tip "Weitere Hilfe"
    Wenn Sie das Problem nicht lösen können, erstellen Sie ein [GitHub Issue](https://github.com/stefanposs/file-flux/issues) mit:

    - Fehlermeldung und Stack-Trace
    - `docker compose logs` Ausgabe
    - FileFlux-Version und Betriebssystem
    - Schritte zum Reproduzieren
