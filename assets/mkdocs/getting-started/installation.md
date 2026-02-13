---
title: "Installation"
weight: 1
---
# Installation

## Prerequisites

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| Docker | 24.0+ | Latest |
| Docker Compose | v2.20+ | Latest |
| RAM | 2 GB | 4 GB |
| Disk | 10 GB | 50 GB+ |
| OS | Linux, macOS, Windows | Linux (Ubuntu 22.04+) |

## Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/stefanposs/file-flux.git
cd file-flux

# Copy environment configuration
cp .env.example .env

# Start all services
just dev
```

This starts:

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3000 | Web dashboard |
| Backend API | 3001 | REST API |
| Backend WS | 3002 | WebSocket endpoint |
| PostgreSQL | 5432 | Database |

## Agent Installation

### Linux / macOS

```bash
curl -sSL https://github.com/stefanposs/file-flux/releases/latest/download/install.sh | bash
```

Or manually:

```bash
# Download the agent binary for your platform
wget https://github.com/stefanposs/file-flux/releases/latest/download/fileflux-agent-linux-amd64
chmod +x fileflux-agent-linux-amd64
mv fileflux-agent-linux-amd64 /usr/local/bin/fileflux-agent

# Configure
fileflux-agent -config /path/to/config.yaml
```

### Windows

```powershell
# Run the PowerShell installer
irm https://github.com/stefanposs/file-flux/releases/latest/download/install.ps1 | iex
```

### Verify Installation

```bash
fileflux-agent -version
```

## Build from Source

```bash
# Prerequisites: Go 1.23+, Node.js 20+, just
just setup
just build
```

## Next Steps

- [Quick Start](quick-start.md) — Configure your first transfer job
- [Configuration](configuration.md) — Customize all settings
