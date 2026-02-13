---
title: "Scheduling"
weight: 6
---
# Scheduling

FileFlux uses cron expressions to schedule recurring file transfer jobs.

## Cron Syntax

```
┌───────── minute (0–59)
│ ┌─────── hour (0–23)
│ │ ┌───── day of month (1–31)
│ │ │ ┌─── month (1–12)
│ │ │ │ ┌─ day of week (0–6, Sun=0)
│ │ │ │ │
* * * * *
```

## Common Schedules

| Expression | Description |
|-----------|-------------|
| `*/5 * * * *` | Every 5 minutes |
| `0 * * * *` | Every hour |
| `0 0 * * *` | Daily at midnight |
| `0 6 * * 1-5` | Weekdays at 6:00 AM |
| `0 0 1 * *` | First day of every month |
| `0 22 * * *` | Every day at 10:00 PM |

## Setting a Schedule

When creating or editing a job:

1. Enter the cron expression in the **Schedule** field
2. The UI shows a human-readable preview
3. Save the job — scheduling starts immediately

## Timezone

All schedules run in the backend server's timezone (default: UTC).

## Manual Override

Scheduled jobs can be triggered manually at any time via **Run Now**. This does not affect the next scheduled execution.
