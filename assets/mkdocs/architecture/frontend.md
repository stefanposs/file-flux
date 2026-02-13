---
title: "Frontend"
weight: 3
---
# Frontend Architecture

The frontend is built with Lit Web Components, TypeScript, and Vite.

## Component Structure

```
frontend/src/
├── core/
│   ├── api/            # Type-safe API client
│   ├── auth/           # Authentication service
│   ├── router/         # Centralized routing
│   └── state/          # Reactive state management
├── shared/
│   ├── styles/         # Design tokens, reset, typography
│   ├── components/     # Reusable UI components
│   └── utils/          # Format helpers, i18n
├── features/
│   ├── dashboard/      # Dashboard view
│   ├── jobs/           # Job management
│   ├── agents/         # Agent management
│   ├── transfers/      # Transfer monitoring
│   └── tokens/         # Token management
└── app-shell.ts        # Layout + router outlet
```

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Lit | 3.x | Web Component framework |
| TypeScript | 5.x | Type safety |
| Vite | 5.x | Build tool |
| @vaadin/router | 1.x | Client-side routing |

## Design System

All components use CSS custom properties (design tokens) for consistent theming:

- Colors: `--ff-color-primary`, `--ff-color-success`, etc.
- Spacing: `--ff-space-sm`, `--ff-space-md`, `--ff-space-lg`
- Typography: `--ff-font-size-base`, `--ff-font-family`
- Shadows: `--ff-shadow-sm`, `--ff-shadow-md`
- Borders: `--ff-radius-sm`, `--ff-radius-md`

## State Management

Uses Lit's reactive properties and a lightweight context-based store for shared state (auth, notifications, theme).

## Real-Time Updates

The frontend connects to the backend's SSE endpoint for live updates:

- Transfer progress changes
- Agent status changes
- Job execution events
- System notifications
