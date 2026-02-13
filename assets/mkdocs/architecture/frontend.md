---
title: "Frontend"
weight: 3
---
# Frontend Architecture

The frontend is built with Lit Web Components, TypeScript, and Vite.

## Component Structure

```
frontend/src/
├── main.ts                 # App bootstrap
├── app.ts                  # Router + app shell
├── demo-mode.ts            # Demo/offline fallback data
├── services/
│   └── api-service.ts      # Type-safe REST API client
├── styles/                 # Global CSS design tokens
├── components/
│   ├── auth/
│   │   └── login.ts        # Split-screen login page
│   ├── dashboard/
│   │   └── dashboard.ts    # Overview with stats cards
│   ├── jobs/
│   │   ├── job-list.ts     # Job table with filters
│   │   └── job-detail.ts   # Job detail + run/edit
│   ├── agents/
│   │   ├── agent-list.ts   # Agent table
│   │   ├── agent-detail.ts # Agent detail + token mgmt
│   │   └── agent-onboarding.ts  # Guided agent setup wizard
│   ├── transfers/
│   │   ├── transfer-list.ts    # Transfer overview + progress bars
│   │   └── transfer-detail.ts  # Transfer detail view
│   ├── tokens/
│   │   └── token-list.ts   # Token CRUD
│   ├── settings/
│   │   └── settings.ts     # User settings + password change
│   └── shared/
│       ├── header.ts       # App header with user menu
│       └── sidebar-navigation.ts  # Nav sidebar
└── utils/
    ├── color-picker.ts     # Agent color generation
    └── demo-mode.ts        # Demo detection helpers
```

## Technology Stack

| Technology | Version | Purpose |
|-----------|---------|---------|
| Lit | 2.6.x | Web Component framework |
| TypeScript | 5.7.x | Type safety |
| Vite | 6.2.x | Build tool + dev server |

## Design System

All components use CSS custom properties (design tokens) for consistent theming:

- **Primary**: `--ff-primary` (Indigo `#4f46e5`)
- **Colors**: `--ff-color-success`, `--ff-color-warning`, `--ff-color-danger`
- **Spacing**: `--ff-space-sm`, `--ff-space-md`, `--ff-space-lg`
- **Typography**: Inter font family, `--ff-font-size-base`
- **Shadows**: `--ff-shadow-sm`, `--ff-shadow-md`
- **Borders**: `--ff-radius-sm`, `--ff-radius-md`

## Routing

Client-side routing is handled in `app.ts` via hash-based navigation:

| Route | Component | Description |
|-------|-----------|-------------|
| `/` | `ff-dashboard` | Dashboard |
| `/login` | `ff-login` | Login |
| `/jobs` | `ff-job-list` | Job-Übersicht |
| `/jobs/:id` | `ff-job-detail` | Job-Detail |
| `/agents` | `ff-agent-list` | Agent-Übersicht |
| `/agents/:id` | `ff-agent-detail` | Agent-Detail |
| `/transfers` | `ff-transfer-list` | Transfer-Übersicht |
| `/transfers/:id` | `ff-transfer-detail` | Transfer-Detail |
| `/tokens` | `ff-token-list` | Token-Verwaltung |
| `/settings` | `ff-settings` | Einstellungen |

## API Client

Der zentrale API-Client (`services/api-service.ts`) bietet typsichere Methoden für alle Backend-Endpunkte und verwaltet JWT-Token automatisch.

## Real-Time Updates

Das Frontend nutzt WebSocket-Verbindungen für Live-Updates:

- Transfer-Fortschritt
- Agent-Status-Änderungen
- Job-Ausführungs-Events
