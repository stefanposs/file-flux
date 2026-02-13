---
title: "Monitoring"
weight: 7
---
# Monitoring

FileFlux provides built-in monitoring and observability through metrics, logs, and health checks.

## Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Backend readiness check (DB connectivity) |

!!! note "Kubernetes Probes"
    Dedizierte Liveness- (`/health/live`) und Readiness-Probes (`/health/ready`) sind für eine zukünftige Version geplant.

## Prometheus Metrics

!!! info "Geplant"
    Prometheus-Metriken unter `/metrics` sind für eine zukünftige Version geplant. Die folgenden Metriken sind vorgesehen:

| Metric | Type | Description |
|--------|------|-------------|
| `fileflux_transfers_total` | Counter | Total transfers by status |
| `fileflux_transfer_bytes_total` | Counter | Total bytes transferred |
| `fileflux_transfer_duration_seconds` | Histogram | Transfer duration |
| `fileflux_agents_connected` | Gauge | Currently connected agents |
| `fileflux_jobs_active` | Gauge | Active job count |
| `fileflux_chunks_transferred` | Counter | Total chunks transferred |
| `fileflux_websocket_messages_total` | Counter | WebSocket messages by type |

## Grafana Dashboard

A pre-built Grafana dashboard is available at `monitoring/grafana/dashboards/`. Import it to visualize:

- Transfer throughput over time
- Agent connection status
- Job success/failure rates
- System resource usage

## Structured Logging

FileFlux uses the Go standard `log` package for logging. Migration to `log/slog` for structured JSON logging is planned (see ADR-009).

```
2024/01/15 10:30:00 [Transfer] Transfer abc-123 completed: report.csv (1048576 bytes, 2340ms)
```

Configure log level via `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`).

## Alerting

Integrate with your existing alerting stack via Prometheus Alertmanager. Example alerts:

- Agent offline for > 5 minutes
- Transfer failure rate > 5% in 15 minutes
- Disk usage > 80% on transfer temp directory
