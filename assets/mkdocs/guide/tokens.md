---
title: Tokens
---
# Tokens

Tokens are used to authenticate agents with the FileFlux backend.

## Token Types

| Type | Purpose | Expiry |
|------|---------|--------|
| Agent Token | Authenticate agent connections | Configurable |

!!! note "User-Authentifizierung"
    User authentifizieren sich per JWT-Token über `POST /auth/login`, nicht über Agent-Tokens.

## Creating Tokens

1. Navigate to **Tokens**
2. Click **Create Token**
3. Set name and optional expiry date
4. Copy the token — **it is shown only once**

!!! warning "Token Security"
    The plaintext token is shown only once at creation time. Store it securely.
    Tokens are currently stored as plain text in the database (`tokens.token_value`).

## Token States

| State | Description |
|-------|-------------|
| `active` | Valid and usable |
| `expired` | Past expiry date |
| `revoked` | Manually disabled |

## Revoking Tokens

Click **Revoke** on any token to immediately invalidate it. Connected agents using a revoked token will be disconnected on the next heartbeat.

## Token Best Practices

- Use unique tokens per agent (never share tokens)
- Set expiry dates for temporary or contractor agents
- Rotate tokens regularly (recommended: every 90 days)
- Revoke tokens immediately when an agent is decommissioned
