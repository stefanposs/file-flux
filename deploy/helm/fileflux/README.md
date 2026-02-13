# File Flux Helm Chart

Kubernetes deployment for File Flux — Managed File Transfer platform.

## Prerequisites

- Kubernetes 1.28+
- Helm 3.12+
- Ingress controller (nginx-ingress or similar)
- cert-manager (for TLS)
- Prometheus Operator (optional, for ServiceMonitor)

## Quick Start

```bash
helm install fileflux ./deploy/helm/fileflux \
  --namespace fileflux --create-namespace \
  --set global.domain=fileflux.example.com \
  --set secrets.dbPassword=YOUR_DB_PASS \
  --set secrets.jwtSecret=YOUR_JWT_SECRET \
  --set secrets.agentToken=YOUR_AGENT_TOKEN
```

## Values

See [values.yaml](values.yaml) for all configurable parameters.
