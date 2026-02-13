---
title: "Production"
weight: 3
---
# Production Deployment

## Security Checklist

- [ ] Change default admin password
- [ ] Set strong `JWT_SECRET` (min 32 characters)
- [ ] Set strong database password
- [ ] Enable TLS/HTTPS (reverse proxy)
- [ ] Disable PostgreSQL external port
- [ ] Enable `DB_SSLMODE=require`
- [ ] Set up firewall rules
- [ ] Configure backup schedule
- [ ] Enable audit logging

## Reverse Proxy (Nginx)

```nginx
server {
    listen 443 ssl http2;
    server_name fileflux.example.com;

    ssl_certificate     /etc/ssl/certs/fileflux.crt;
    ssl_certificate_key /etc/ssl/private/fileflux.key;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400;
    }
}
```

## Backup Strategy

### Database Backup

```bash
# Manual backup
just db-backup

# Automated (add to crontab)
0 2 * * * docker compose exec -T db pg_dump -U fileflux fileflux | gzip > /backup/fileflux-$(date +\%Y\%m\%d).sql.gz
```

### Restore

```bash
gunzip -c backup.sql.gz | docker compose exec -T db psql -U fileflux fileflux
```

## Resource Recommendations

| Agents | CPU | RAM | Disk |
|--------|-----|-----|------|
| 1–10 | 2 cores | 4 GB | 50 GB |
| 10–50 | 4 cores | 8 GB | 100 GB |
| 50–200 | 8 cores | 16 GB | 500 GB |
| 200+ | 16 cores | 32 GB | 1 TB+ |

## Monitoring

See [Monitoring Guide](../guide/monitoring.md) for Prometheus/Grafana setup.
