---
title: API Reference
---
# API Reference

FileFlux bietet eine REST-API für CRUD-Operationen, eine WebSocket-API für Echtzeit-Kommunikation mit Agenten und eine File-API für den eigentlichen Dateitransfer.

<div class="grid cards" markdown>

- :material-api: **[REST Endpoints](rest.md)** — Auth, Agents, Jobs, Transfers, Tokens, Files, Health
- :material-websocket: **[WebSocket API](websocket.md)** — Agenten-Kommunikation und SSE-Events
- :material-code-json: **[Schemas](schemas.md)** — JSON-Schemata aller Entitäten

</div>

## Authentifizierung

Alle API-Aufrufe (außer `/auth/login` und `/health`) erfordern einen `Authorization: Bearer <token>` Header.

| Token-Typ | Verwendung | Gültigkeit |
|-----------|-----------|------------|
| JWT (User) | REST-API-Zugriff | Konfigurierbar (Standard: 24h) |
| Agent-Token | WebSocket + File-API | Bis Widerruf oder Ablaufdatum |
