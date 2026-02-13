---
title: "Dashboard"
weight: 1
---
# Dashboard

The FileFlux dashboard provides a real-time overview of your entire file transfer infrastructure.

## Overview Cards

The top row shows key metrics:

- **Active Agents** — Number of connected agents
- **Running Jobs** — Currently executing transfer jobs
- **Today's Transfers** — Completed transfers in the last 24h
- **Success Rate** — Percentage of successful transfers

## Recent Transfers

A live-updating table showing the most recent transfers with:

| Column | Description |
|--------|-------------|
| Status | Current state (pending, running, completed, failed) |
| Job | Parent job name |
| Source → Dest | Source agent/path → Destination agent/path |
| File | Filename and size |
| Speed | Transfer speed |
| Started | Timestamp |

## Agent Status

A panel showing all registered agents with their connection status:

- 🟢 **Online** — Connected and ready
- 🟡 **Idle** — Connected but no active transfers
- 🔴 **Offline** — Not connected

## Real-Time Updates

The dashboard uses Server-Sent Events (SSE) for live updates. No page refresh needed — transfers, agent status, and metrics update automatically.
