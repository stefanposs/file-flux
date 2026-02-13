---
title: "Installation Guide"
weight: 1
---
# Installation Guide

## Deployment Options

| Method | Best For | Complexity |
|--------|----------|------------|
| Docker Compose | Development, small deployments | Low |
| Docker Compose (Production) | Single-server production | Medium |
| Kubernetes + Helm | Multi-node, high availability | High |

## Docker Compose

### Prerequisites
- Docker 24.0+
- Docker Compose v2.20+
- 4 GB RAM minimum

### Steps

```bash
# 1. Clone repository
git clone https://github.com/stefanposs/file-flux.git
cd file-flux

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings (especially JWT_SECRET and passwords)

# 3. Start services
docker compose up -d

# 4. Verify
docker compose ps
curl http://localhost:3001/health
```

### Initial Setup

1. Open `http://localhost:3000`
2. Login with default admin credentials
3. **Change the admin password immediately**
4. Create agent tokens
5. Install agents on endpoint machines

## Kubernetes

### Prerequisites
- Kubernetes 1.28+
- Helm 3.x
- `kubectl` configured

### Helm Installation

```bash
# Add FileFlux helm repo
helm repo add fileflux https://stefanposs.github.io/file-flux/charts

# Install
helm install fileflux fileflux/file-flux \
  --namespace fileflux \
  --create-namespace \
  --set backend.jwtSecret="your-secret-here" \
  --set postgresql.auth.password="db-password"

# Verify
kubectl -n fileflux get pods
```

See [Production](production.md) for hardening guidance.
