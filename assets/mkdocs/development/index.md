---
title: Development
---
# Development

Richtlinien, Werkzeuge und Prozesse für die Entwicklung an FileFlux.

<div class="grid cards" markdown>

- :material-source-pull: **[Contributing](contributing.md)** — Workflow, Branch-Strategie und PR-Checkliste
- :material-test-tube: **[Testing](testing.md)** — Teststrategie, Coverage und E2E-Tests
- :material-format-paint: **[Code Style](code-style.md)** — Go- und TypeScript-Stilrichtlinien
- :material-file-document: **[ADRs](adrs.md)** — Architecture Decision Records

</div>

## Lokale Entwicklungsumgebung

```bash
# Backend starten (Hot Reload)
cd backend && go run ./cmd/server

# Frontend starten (Vite Dev Server)
cd frontend && npm install && npm run dev

# Agent starten
cd agent && go run ./cmd/agent -- -config config.yaml

# Oder alles via Docker Compose
docker compose up -d
```
