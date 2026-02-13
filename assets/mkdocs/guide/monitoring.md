---
title: "Monitoring"
weight: 7
---
# Monitoring

FileFlux provides built-in monitoring and observability through metrics, logs, and health checks.

## Health Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Backend readiness check |
| `GET /health/live` | Liveness probe (for Kubernetes) |
| `GET /health/ready` | Readiness probe (DB + WebSocket) |

## Prometheus Metrics

FileFlux exposes metrics at `/metrics` in Prometheus format:

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

FileFlux uses `log/slog` for structured JSON logging:

```json
{
  "time": "2024-01-15T10:30:00Z",
  "level": "INFO",
  "msg": "transfer completed",
  "transfer_id": "abc-123",
  "job_id": 42,
  "file": "report.csv",
  "size": 1048576,
  "duration_ms": 2340,
  "checksum": "sha256:a1b2c3..."
}
```

Configure log level via `LOG_LEVEL` environment variable (`debug`, `info`, `warn`, `error`).

## Alerting

Integrate with your existing alerting stack via Prometheus Alertmanager. Example alerts:

- Agent offline for > 5 minutes
- Transfer failure rate > 5% in 15 minutes
- Disk usage > 80% on transfer temp directory
