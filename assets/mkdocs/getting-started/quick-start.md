---
title: Quick Start
---
# Quick Start

Get your first file transfer running in under 5 minutes.

## 1. Start the Platform

```bash
git clone https://github.com/stefanposs/file-flux.git
cd file-flux
just dev
```

## 2. Log In

Open [http://localhost:3000](http://localhost:3000) and log in:

| Field | Value |
|-------|-------|
| Email | `admin@fileflux.de` |
| Password | `admin123` |

!!! warning
    **Change the default password in production!**

## 3. Register an Agent

Navigate to **Tokens** and create a new agent registration token:

1. Click **Create Token**
2. Set a name (e.g., "dev-agent")
3. Copy the generated token

## 4. Connect an Agent

In a new terminal:

```bash
# Start a local agent
cd agent
go run ./cmd/agent --token YOUR_TOKEN_HERE
```

The agent appears in the **Agents** dashboard within seconds.

## 5. Create a Transfer Job

Navigate to **Jobs** → **Create Job**:

| Field | Value |
|-------|-------|
| Name | My First Transfer |
| Type | Push |
| Source Agent | dev-agent |
| Source Path | `/tmp/outbox/` |
| Destination Agent | (another agent) |
| Destination Path | `/tmp/inbox/` |

Click **Create** and then **Run Now** to execute the transfer.

## 6. Monitor the Transfer

Navigate to **Transfers** to see real-time progress:

- Transfer status (pending → running → completed)
- File size and speed
- SHA-256 checksum verification

## Next Steps

- [Configuration](configuration.md) — Customize settings via environment variables
- [Dashboard Guide](../guide/dashboard.md) — Deep dive into real-time monitoring
- [Architecture Overview](../architecture/overview.md) — Understand how the pieces fit together
