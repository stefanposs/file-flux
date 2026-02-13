---
title: Getting Started
---
# Getting Started

FileFlux lässt sich in wenigen Minuten lokal starten. Dieser Abschnitt führt Sie von der Installation über die Erstkonfiguration bis zum ersten erfolgreichen Dateitransfer.

<div class="grid cards" markdown>

- :material-download: **[Installation](installation.md)** — Docker Compose, Agent-Setup, Build from Source
- :material-rocket-launch: **[Quick Start](quick-start.md)** — Ihr erster Transfer in 5 Minuten
- :material-cog: **[Konfiguration](configuration.md)** — Alle Einstellungen für Backend, Agent und Docker

</div>

## Voraussetzungen

| Komponente | Minimum | Empfohlen |
|------------|---------|----------|
| Docker | 20.10+ | 24.x |
| Docker Compose | 2.x | 2.24+ |
| Freier RAM | 1 GB | 2 GB |
| Disk | 5 GB | 20 GB+ |

!!! tip "Schnellster Einstieg"
    ```bash
    git clone https://github.com/stefanposs/file-flux.git
    cd file-flux
    docker compose up -d
    ```
    Dann öffnen Sie [http://localhost:3000](http://localhost:3000) und melden sich mit `admin@fileflux.de` / `admin123` an.
