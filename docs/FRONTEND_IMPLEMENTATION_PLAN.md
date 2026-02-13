# File Flux — Frontend Implementation Plan

> Enterprise-grade MFT platform UI built with **Lit Web Components + TypeScript + Vite**
> Target UX benchmark: Stonebranch Universal Automation Center

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Design System Specification](#2-design-system-specification)
3. [File & Folder Structure](#3-file--folder-structure)
4. [Component Hierarchy & Catalog](#4-component-hierarchy--catalog)
5. [Router & New Pages](#5-router--new-pages)
6. [State Management](#6-state-management)
7. [SSE / Real-Time Integration](#7-sse--real-time-integration)
8. [Charting Library](#8-charting-library)
9. [Shared Component Specifications](#9-shared-component-specifications)
10. [Feature Component Specifications](#10-feature-component-specifications)
11. [Phased Implementation Plan](#11-phased-implementation-plan)
12. [Testing Strategy](#12-testing-strategy)
13. [Performance Budget](#13-performance-budget)

---

## 1. Current State Analysis

### What Exists

| Component | Tag | Lines | Notes |
|---|---|---|---|
| App Shell | `<file-flux-app>` | 507 | Routing, auth, layout — monolithic |
| Header | `<ff-header>` | 257 | Top nav + user menu |
| Sidebar | `<ff-sidebar-navigation>` | ~180 | Collapsible, emoji icons |
| Dashboard | `<ff-dashboard>` | 563 | Stats cards + transfer table |
| Job List | `<ff-job-list>` | 647 | Grid cards, filters, create modal |
| Job Detail | `<ff-job-detail>` | 674 | Overview, transfers, delete |
| Agent List | `<ff-agent-list>` | 501 | Grid cards, filters |
| Agent Detail | `<ff-agent-detail>` | 962 | Tabs, tokens, transfers |
| Transfer List | `<ff-transfer-list>` | 670 | Table, filters, pagination |
| Transfer Detail | `<ff-transfer-detail>` | 753 | Progress, logs, retry |
| Token List | `<ff-token-list>` | 772 | Table, create modal |
| Login | `<ff-login>` | 157 | Basic form |
| Demo Mode | `demo-mode.ts` | 563 | Mock data |

### Problems to Fix

1. **No shared component library** — every component re-implements tables, modals, filters, status badges, spinners.
2. **No design tokens** — colors hardcoded (`#122e53`, `#dee2e6`) across every file.
3. **No state management** — each component fetches its own data; no cross-component reactivity.
4. **No API client layer** — demo mode checks scattered everywhere.
5. **Routing baked into app.ts** — manual `switch` statement, no guards, no lazy loading.
6. **No real-time** — no SSE/WebSocket consumer on the frontend.
7. **No icon system** — emoji characters used for navigation icons.
8. **Heavy component files** (500–960 lines) — need decomposition.

---

## 2. Design System Specification

### 2.1 CSS Custom Properties (Design Tokens)

Create `src/styles/tokens.ts`:

```typescript
import { css } from 'lit';

export const tokens = css`
  :host {
    /* ── Color Palette ── */
    --ff-color-primary:       #122e53;
    --ff-color-primary-light: #1a4b8a;
    --ff-color-primary-dark:  #0a1c33;
    --ff-color-primary-50:    rgba(18, 46, 83, 0.05);
    --ff-color-primary-100:   rgba(18, 46, 83, 0.10);

    --ff-color-secondary:       #ffb951;
    --ff-color-secondary-light: #ffd080;
    --ff-color-secondary-dark:  #e9a93e;

    --ff-color-success:     #10b981;
    --ff-color-success-bg:  rgba(16, 185, 129, 0.10);
    --ff-color-error:       #ef4444;
    --ff-color-error-bg:    rgba(239, 68, 68, 0.10);
    --ff-color-warning:     #f59e0b;
    --ff-color-warning-bg:  rgba(245, 158, 11, 0.10);
    --ff-color-info:        #3b82f6;
    --ff-color-info-bg:     rgba(59, 130, 246, 0.10);

    /* ── Neutral Palette ── */
    --ff-color-gray-50:   #f9fafb;
    --ff-color-gray-100:  #f3f4f6;
    --ff-color-gray-200:  #e5e7eb;
    --ff-color-gray-300:  #d1d5db;
    --ff-color-gray-400:  #9ca3af;
    --ff-color-gray-500:  #6b7280;
    --ff-color-gray-600:  #4b5563;
    --ff-color-gray-700:  #374151;
    --ff-color-gray-800:  #1f2937;
    --ff-color-gray-900:  #111827;

    /* ── Typography ── */
    --ff-font-family:   'Inter', 'Roboto', system-ui, sans-serif;
    --ff-font-mono:     'JetBrains Mono', 'Fira Code', monospace;

    --ff-text-xs:    0.75rem;   /* 12px */
    --ff-text-sm:    0.875rem;  /* 14px */
    --ff-text-base:  1rem;      /* 16px */
    --ff-text-lg:    1.125rem;  /* 18px */
    --ff-text-xl:    1.25rem;   /* 20px */
    --ff-text-2xl:   1.5rem;    /* 24px */
    --ff-text-3xl:   1.875rem;  /* 30px */

    --ff-font-normal:    400;
    --ff-font-medium:    500;
    --ff-font-semibold:  600;
    --ff-font-bold:      700;

    /* ── Spacing ── */
    --ff-space-1:  4px;
    --ff-space-2:  8px;
    --ff-space-3:  12px;
    --ff-space-4:  16px;
    --ff-space-5:  20px;
    --ff-space-6:  24px;
    --ff-space-8:  32px;
    --ff-space-10: 40px;
    --ff-space-12: 48px;

    /* ── Border Radius ── */
    --ff-radius-sm:   4px;
    --ff-radius-md:   6px;
    --ff-radius-lg:   8px;
    --ff-radius-xl:   12px;
    --ff-radius-full: 9999px;

    /* ── Shadows ── */
    --ff-shadow-sm:   0 1px 2px rgba(0, 0, 0, 0.05);
    --ff-shadow-md:   0 2px 4px rgba(0, 0, 0, 0.06), 0 1px 2px rgba(0, 0, 0, 0.04);
    --ff-shadow-lg:   0 4px 6px rgba(0, 0, 0, 0.07), 0 2px 4px rgba(0, 0, 0, 0.04);
    --ff-shadow-xl:   0 10px 15px rgba(0, 0, 0, 0.10), 0 4px 6px rgba(0, 0, 0, 0.05);

    /* ── Transitions ── */
    --ff-transition-fast: 150ms ease;
    --ff-transition-base: 200ms ease;
    --ff-transition-slow: 300ms ease;

    /* ── Z-Index ── */
    --ff-z-dropdown:  100;
    --ff-z-sticky:    200;
    --ff-z-overlay:   300;
    --ff-z-modal:     400;
    --ff-z-toast:     500;

    /* ── Layout ── */
    --ff-sidebar-width:          240px;
    --ff-sidebar-collapsed-width: 64px;
    --ff-header-height:          56px;
    --ff-content-max-width:      1440px;
  }
`;
```

### 2.2 Dark Mode Strategy

Use a `data-theme="dark"` attribute on `:host` and override tokens:

```typescript
export const darkTokens = css`
  :host([data-theme="dark"]) {
    --ff-color-gray-50:  #111827;
    --ff-color-gray-100: #1f2937;
    --ff-color-gray-200: #374151;
    --ff-color-gray-700: #d1d5db;
    --ff-color-gray-800: #e5e7eb;
    --ff-color-gray-900: #f9fafb;
    /* ... remaining overrides */
  }
`;
```

### 2.3 Icon System

Use **Material Symbols Outlined** (variable font, tree-shakeable via CSS).

```html
<!-- index.html -->
<link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL@20..48,100..700,0..1" rel="stylesheet">
```

Create `<ff-icon>` wrapper:

```typescript
// src/components/ui/icon.ts
@customElement('ff-icon')
export class FfIcon extends LitElement {
  @property() name = '';
  @property() size: 'sm' | 'md' | 'lg' = 'md';
  render() {
    return html`<span class="material-symbols-outlined ${this.size}">${this.name}</span>`;
  }
}
```

---

## 3. File & Folder Structure

```
frontend/src/
├── main.ts                          # Mount point
├── app.ts                           # Shell: sidebar + header + router outlet
├── router.ts                        # Declarative route config, lazy loading
│
├── styles/
│   ├── tokens.ts                    # Design tokens (CSS custom properties)
│   ├── theme.ts                     # Dark/light theme switcher
│   ├── reset.ts                     # CSS reset shared styles
│   └── mixins.ts                    # Reusable CSS snippets (truncate, scrollbar, etc.)
│
├── state/
│   ├── store.ts                     # Central reactive store (singleton)
│   ├── auth.store.ts                # Auth state slice
│   ├── agents.store.ts              # Agent state slice
│   ├── jobs.store.ts                # Job state slice
│   ├── transfers.store.ts           # Transfer state slice
│   ├── notifications.store.ts       # Toast / notification state
│   └── ui.store.ts                  # Sidebar, theme, search, keyboard shortcuts
│
├── services/
│   ├── api-client.ts                # Fetch wrapper with auth, error handling
│   ├── sse-client.ts                # SSE consumer for real-time events
│   ├── auth.service.ts              # Login, logout, token refresh
│   ├── agents.service.ts            # Agent CRUD
│   ├── jobs.service.ts              # Job CRUD + run
│   ├── transfers.service.ts         # Transfer CRUD + cancel
│   ├── tokens.service.ts            # Token CRUD
│   ├── analytics.service.ts         # Reporting data
│   ├── settings.service.ts          # Admin settings
│   └── demo.service.ts              # Demo mode data (replaces demo-mode.ts)
│
├── types/
│   ├── agent.ts                     # Agent, AgentGroup, AgentMetrics
│   ├── job.ts                       # Job, JobRun, CronSchedule, RetryPolicy
│   ├── transfer.ts                  # Transfer, TransferChunk, TransferStats
│   ├── user.ts                      # User, Role, Permission
│   ├── token.ts                     # Token
│   ├── workflow.ts                  # Workflow, WorkflowNode, WorkflowEdge
│   ├── analytics.ts                 # ChartData, Report, TimeRange
│   ├── common.ts                    # PaginatedResponse, AsyncState, SortConfig
│   └── events.ts                    # SSE event payloads
│
├── utils/
│   ├── format.ts                    # formatBytes, formatDate, formatDuration, etc.
│   ├── cron.ts                      # Cron expression parser/builder
│   ├── validators.ts                # Form validation helpers
│   ├── keyboard.ts                  # Keyboard shortcut registry
│   ├── export.ts                    # CSV/PDF export utilities
│   └── debounce.ts                  # Debounce/throttle helpers
│
├── components/
│   ├── ui/                          # ──── DESIGN SYSTEM PRIMITIVES ────
│   │   ├── icon.ts                  # <ff-icon name="...">
│   │   ├── button.ts               # <ff-button variant="primary|secondary|ghost|danger">
│   │   ├── badge.ts                # <ff-badge status="success|error|warning|info">
│   │   ├── card.ts                 # <ff-card> with header/body/footer slots
│   │   ├── data-table.ts           # <ff-data-table> sortable, filterable, paginated
│   │   ├── modal.ts               # <ff-modal> overlay dialog
│   │   ├── drawer.ts              # <ff-drawer> slide-in panel
│   │   ├── toast.ts               # <ff-toast-container> + notification stack
│   │   ├── dropdown.ts            # <ff-dropdown> menu
│   │   ├── tabs.ts                # <ff-tabs> + <ff-tab-panel>
│   │   ├── tooltip.ts             # <ff-tooltip>
│   │   ├── progress-bar.ts        # <ff-progress-bar percent="65" speed="8MB/s">
│   │   ├── skeleton.ts            # <ff-skeleton variant="text|circle|rect">
│   │   ├── empty-state.ts         # <ff-empty-state icon="..." title="..." action="...">
│   │   ├── confirm-dialog.ts      # <ff-confirm-dialog> for destructive actions
│   │   ├── search-input.ts        # <ff-search-input> with debounce
│   │   ├── select.ts              # <ff-select> styled dropdown
│   │   ├── checkbox.ts            # <ff-checkbox>
│   │   ├── toggle.ts              # <ff-toggle> switch
│   │   ├── text-input.ts          # <ff-text-input> with label, error, helper text
│   │   ├── textarea.ts            # <ff-textarea>
│   │   ├── form-field.ts          # <ff-form-field> wrapper with label + validation
│   │   ├── breadcrumb.ts          # <ff-breadcrumb>
│   │   ├── avatar.ts              # <ff-avatar name="..." src="...">
│   │   ├── chip.ts                # <ff-chip> removable tag
│   │   ├── timeline.ts            # <ff-timeline> vertical event list
│   │   ├── stat-card.ts           # <ff-stat-card icon="..." value="..." label="...">
│   │   ├── code-block.ts          # <ff-code-block language="bash">
│   │   └── chart.ts               # <ff-chart type="line|bar|donut" .data=${}>
│   │
│   ├── layout/                      # ──── LAYOUT COMPONENTS ────
│   │   ├── app-shell.ts            # <ff-app-shell> sidebar + header + main slot
│   │   ├── sidebar.ts              # <ff-sidebar> collapsible navigation
│   │   ├── header.ts               # <ff-header> top bar
│   │   ├── page-header.ts          # <ff-page-header title="..." breadcrumb="...">
│   │   └── content-layout.ts       # <ff-content-layout> max-width wrapper
│   │
│   ├── auth/                        # ──── AUTH ────
│   │   └── login-page.ts           # <ff-login-page>
│   │
│   ├── dashboard/                   # ──── DASHBOARD ────
│   │   ├── dashboard-page.ts       # <ff-dashboard-page> (orchestrator)
│   │   ├── stats-overview.ts       # <ff-stats-overview> row of stat cards
│   │   ├── activity-stream.ts      # <ff-activity-stream> real-time SSE feed
│   │   ├── throughput-chart.ts     # <ff-throughput-chart> line chart (KB/s)
│   │   ├── agent-status-grid.ts    # <ff-agent-status-grid> health map
│   │   ├── active-jobs-timeline.ts # <ff-active-jobs-timeline> horizontal timeline
│   │   ├── system-health.ts        # <ff-system-health> gauges
│   │   └── quick-actions.ts        # <ff-quick-actions> shortcut cards
│   │
│   ├── jobs/                        # ──── JOB MANAGEMENT ────
│   │   ├── job-list-page.ts        # <ff-job-list-page>
│   │   ├── job-detail-page.ts      # <ff-job-detail-page>
│   │   ├── job-card.ts             # <ff-job-card> list item
│   │   ├── job-builder.ts          # <ff-job-builder> visual source → dest editor
│   │   ├── cron-builder.ts         # <ff-cron-builder> visual cron expression UI
│   │   ├── job-run-history.ts      # <ff-job-run-history> table of past runs
│   │   ├── retry-policy-editor.ts  # <ff-retry-policy-editor>
│   │   ├── file-pattern-input.ts   # <ff-file-pattern-input> glob tester
│   │   └── job-bulk-actions.ts     # <ff-job-bulk-actions> toolbar
│   │
│   ├── agents/                      # ──── AGENT MANAGEMENT ────
│   │   ├── agent-list-page.ts      # <ff-agent-list-page>
│   │   ├── agent-detail-page.ts    # <ff-agent-detail-page>
│   │   ├── agent-card.ts           # <ff-agent-card>
│   │   ├── agent-health-panel.ts   # <ff-agent-health-panel> CPU/mem/disk
│   │   ├── agent-registration.ts   # <ff-agent-registration> wizard
│   │   ├── connection-test.ts      # <ff-connection-test> real-time feedback
│   │   ├── install-script.ts       # <ff-install-script> multi-OS commands
│   │   └── agent-config-editor.ts  # <ff-agent-config-editor>
│   │
│   ├── transfers/                   # ──── TRANSFER MONITORING ────
│   │   ├── transfer-list-page.ts   # <ff-transfer-list-page>
│   │   ├── transfer-detail-page.ts # <ff-transfer-detail-page>
│   │   ├── transfer-row.ts         # <ff-transfer-row> table row with progress
│   │   ├── transfer-progress.ts    # <ff-transfer-progress> bar + speed + ETA
│   │   ├── transfer-queue.ts       # <ff-transfer-queue> pending queue visual
│   │   ├── chunk-detail.ts         # <ff-chunk-detail> per-chunk status grid
│   │   └── transfer-comparison.ts  # <ff-transfer-comparison> before/after sizes
│   │
│   ├── tokens/                      # ──── TOKEN MANAGEMENT ────
│   │   ├── token-list-page.ts      # <ff-token-list-page>
│   │   └── token-create-modal.ts   # <ff-token-create-modal>
│   │
│   ├── analytics/                   # ──── ANALYTICS & REPORTING ────
│   │   ├── analytics-page.ts       # <ff-analytics-page>
│   │   ├── volume-chart.ts         # <ff-volume-chart> transfers over time
│   │   ├── success-rate-chart.ts   # <ff-success-rate-chart> trend line
│   │   ├── agent-uptime-chart.ts   # <ff-agent-uptime-chart>
│   │   ├── job-duration-chart.ts   # <ff-job-duration-chart>
│   │   ├── data-volume-report.ts   # <ff-data-volume-report> table + chart
│   │   └── report-export.ts        # <ff-report-export> CSV/PDF
│   │
│   ├── workflows/                   # ──── WORKFLOW BUILDER ────
│   │   ├── workflow-list-page.ts   # <ff-workflow-list-page>
│   │   ├── workflow-editor.ts      # <ff-workflow-editor> canvas + toolbar
│   │   ├── workflow-node.ts        # <ff-workflow-node> draggable node
│   │   ├── workflow-edge.ts        # <ff-workflow-edge> SVG connector
│   │   ├── node-palette.ts         # <ff-node-palette> drag source sidebar
│   │   ├── node-properties.ts      # <ff-node-properties> config panel
│   │   └── workflow-templates.ts   # <ff-workflow-templates>
│   │
│   ├── settings/                    # ──── SETTINGS & ADMIN ────
│   │   ├── settings-page.ts        # <ff-settings-page> tabbed layout
│   │   ├── user-management.ts      # <ff-user-management> RBAC table
│   │   ├── webhook-config.ts       # <ff-webhook-config>
│   │   ├── notification-rules.ts   # <ff-notification-rules>
│   │   ├── system-settings.ts      # <ff-system-settings> compression/chunk/retention
│   │   ├── audit-log.ts            # <ff-audit-log> searchable event log
│   │   └── api-key-management.ts   # <ff-api-key-management>
│   │
│   └── global/                      # ──── GLOBAL OVERLAYS ────
│       ├── global-search.ts        # <ff-global-search> cmd+k modal
│       ├── command-palette.ts      # <ff-command-palette>
│       └── keyboard-shortcuts.ts   # <ff-keyboard-shortcuts> help dialog
```

---

## 4. Component Hierarchy & Catalog

### 4.1 App Shell Hierarchy

```
<file-flux-app>
 ├── <ff-login-page>                   (if !authenticated)
 └── <ff-app-shell>                    (if authenticated)
      ├── <ff-sidebar>
      │    ├── Logo
      │    ├── Nav Groups (Main, Automation, Admin)
      │    └── Collapse toggle
      ├── <ff-header>
      │    ├── <ff-breadcrumb>
      │    ├── <ff-global-search>       (trigger)
      │    ├── Notification bell
      │    ├── <ff-avatar>
      │    └── Theme toggle
      ├── <ff-toast-container>          (fixed position)
      └── <main>                        (router outlet)
           └── [current page component]
```

### 4.2 Page → Child Component Map

```
Dashboard Page
 ├── <ff-page-header title="Dashboard">
 ├── <ff-stats-overview>
 │    └── 6× <ff-stat-card>
 ├── <ff-throughput-chart>
 │    └── <ff-chart type="line">
 ├── <ff-activity-stream>
 │    └── <ff-timeline>
 ├── <ff-agent-status-grid>
 │    └── N× <ff-agent-card variant="compact">
 ├── <ff-active-jobs-timeline>
 └── <ff-quick-actions>
      └── 4× <ff-card>

Job List Page
 ├── <ff-page-header title="Jobs">
 │    └── <ff-button @click=${createJob}>Create Job</ff-button>
 ├── <ff-job-bulk-actions>
 ├── Filters: <ff-search-input>, <ff-select>(status), <ff-select>(type)
 └── <ff-data-table>
      └── N× <ff-job-card> (or table rows)

Job Detail Page
 ├── <ff-page-header>
 │    └── <ff-breadcrumb items=${['Jobs', jobName]}>
 ├── <ff-tabs>
 │    ├── Tab: Overview → <ff-job-builder readonly>
 │    ├── Tab: Schedule → <ff-cron-builder>
 │    ├── Tab: History → <ff-job-run-history>
 │    │                    └── <ff-data-table>
 │    ├── Tab: Settings
 │    │    ├── <ff-retry-policy-editor>
 │    │    └── <ff-file-pattern-input>
 │    └── Tab: Logs → <ff-code-block>

Agent Detail Page
 ├── <ff-page-header>
 ├── <ff-tabs>
 │    ├── Tab: Overview
 │    │    ├── <ff-agent-health-panel>
 │    │    │    └── 3× <ff-chart type="donut"> (CPU, mem, disk)
 │    │    └── <ff-connection-test>
 │    ├── Tab: Configuration → <ff-agent-config-editor>
 │    ├── Tab: Transfers → <ff-data-table>
 │    ├── Tab: Tokens → <ff-data-table>
 │    └── Tab: Install → <ff-install-script>

Transfer Detail Page
 ├── <ff-page-header>
 ├── <ff-transfer-progress>
 ├── <ff-transfer-comparison>
 ├── <ff-chunk-detail>
 │    └── Grid of chunk status indicators
 └── <ff-timeline> (log entries)

Workflow Editor Page
 ├── <ff-page-header>
 ├── Toolbar: Save, Run, Undo/Redo, Zoom
 ├── <ff-node-palette>             (left sidebar)
 ├── <ff-workflow-editor>          (center canvas)
 │    ├── N× <ff-workflow-node>
 │    └── N× <ff-workflow-edge>    (SVG)
 └── <ff-node-properties>          (right panel)

Analytics Page
 ├── <ff-page-header>
 ├── Date range picker
 ├── <ff-volume-chart>
 ├── <ff-success-rate-chart>
 ├── <ff-agent-uptime-chart>
 ├── <ff-job-duration-chart>
 ├── <ff-data-volume-report>
 └── <ff-report-export>

Settings Page
 ├── <ff-page-header>
 └── <ff-tabs>
      ├── General → <ff-system-settings>
      ├── Users → <ff-user-management>
      ├── Webhooks → <ff-webhook-config>
      ├── Notifications → <ff-notification-rules>
      ├── API Keys → <ff-api-key-management>
      └── Audit Log → <ff-audit-log>
```

---

## 5. Router & New Pages

### 5.1 Route Configuration

Create a declarative router in `src/router.ts`:

```typescript
export interface Route {
  path: string;
  component: string;         // tag name
  importPath: string;        // lazy-load module path
  title: string;
  icon: string;              // Material Symbol name
  showInNav: boolean;
  navGroup?: 'main' | 'automation' | 'admin';
  children?: Route[];
  guard?: 'auth' | 'admin';
}

export const routes: Route[] = [
  {
    path: '/',
    component: 'ff-dashboard-page',
    importPath: './components/dashboard/dashboard-page.ts',
    title: 'Dashboard',
    icon: 'dashboard',
    showInNav: true,
    navGroup: 'main',
  },
  {
    path: '/jobs',
    component: 'ff-job-list-page',
    importPath: './components/jobs/job-list-page.ts',
    title: 'Jobs',
    icon: 'work',
    showInNav: true,
    navGroup: 'main',
  },
  {
    path: '/jobs/:id',
    component: 'ff-job-detail-page',
    importPath: './components/jobs/job-detail-page.ts',
    title: 'Job Detail',
    icon: 'work',
    showInNav: false,
  },
  {
    path: '/jobs/new',
    component: 'ff-job-builder',
    importPath: './components/jobs/job-builder.ts',
    title: 'Create Job',
    icon: 'add',
    showInNav: false,
  },
  {
    path: '/transfers',
    component: 'ff-transfer-list-page',
    importPath: './components/transfers/transfer-list-page.ts',
    title: 'Transfers',
    icon: 'swap_horiz',
    showInNav: true,
    navGroup: 'main',
  },
  {
    path: '/transfers/:id',
    component: 'ff-transfer-detail-page',
    importPath: './components/transfers/transfer-detail-page.ts',
    title: 'Transfer Detail',
    icon: 'swap_horiz',
    showInNav: false,
  },
  {
    path: '/agents',
    component: 'ff-agent-list-page',
    importPath: './components/agents/agent-list-page.ts',
    title: 'Agents',
    icon: 'dns',
    showInNav: true,
    navGroup: 'main',
  },
  {
    path: '/agents/:id',
    component: 'ff-agent-detail-page',
    importPath: './components/agents/agent-detail-page.ts',
    title: 'Agent Detail',
    icon: 'dns',
    showInNav: false,
  },
  {
    path: '/agents/register',
    component: 'ff-agent-registration',
    importPath: './components/agents/agent-registration.ts',
    title: 'Register Agent',
    icon: 'add',
    showInNav: false,
  },
  {
    path: '/tokens',
    component: 'ff-token-list-page',
    importPath: './components/tokens/token-list-page.ts',
    title: 'Tokens',
    icon: 'key',
    showInNav: true,
    navGroup: 'admin',
  },
  {
    path: '/workflows',
    component: 'ff-workflow-list-page',
    importPath: './components/workflows/workflow-list-page.ts',
    title: 'Workflows',
    icon: 'account_tree',
    showInNav: true,
    navGroup: 'automation',
  },
  {
    path: '/workflows/:id',
    component: 'ff-workflow-editor',
    importPath: './components/workflows/workflow-editor.ts',
    title: 'Workflow Editor',
    icon: 'account_tree',
    showInNav: false,
  },
  {
    path: '/analytics',
    component: 'ff-analytics-page',
    importPath: './components/analytics/analytics-page.ts',
    title: 'Analytics',
    icon: 'analytics',
    showInNav: true,
    navGroup: 'automation',
  },
  {
    path: '/settings',
    component: 'ff-settings-page',
    importPath: './components/settings/settings-page.ts',
    title: 'Settings',
    icon: 'settings',
    showInNav: true,
    navGroup: 'admin',
  },
];
```

### 5.2 Router Implementation

Lightweight client-side router (no library needed for Lit):

```typescript
// src/router.ts
class Router {
  private routes: Route[] = [];
  private currentRoute: Route | null = null;
  private params: Record<string, string> = {};

  constructor(routes: Route[]) {
    this.routes = routes;
    window.addEventListener('popstate', () => this.resolve());
  }

  async resolve(): Promise<{ route: Route; params: Record<string, string> }> {
    const path = window.location.pathname;
    for (const route of this.routes) {
      const match = this.matchPath(route.path, path);
      if (match) {
        // Lazy-load component module
        await import(/* @vite-ignore */ route.importPath);
        this.currentRoute = route;
        this.params = match;
        return { route, params: match };
      }
    }
    // 404 fallback
    return { route: this.routes[0], params: {} };
  }

  navigate(path: string) {
    window.history.pushState(null, '', path);
    this.resolve();
    // Dispatch custom event for app shell
    window.dispatchEvent(new CustomEvent('route-changed', {
      detail: { path }
    }));
  }

  private matchPath(pattern: string, path: string): Record<string, string> | null {
    const patternParts = pattern.split('/');
    const pathParts = path.split('/');
    if (patternParts.length !== pathParts.length) return null;

    const params: Record<string, string> = {};
    for (let i = 0; i < patternParts.length; i++) {
      if (patternParts[i].startsWith(':')) {
        params[patternParts[i].slice(1)] = pathParts[i];
      } else if (patternParts[i] !== pathParts[i]) {
        return null;
      }
    }
    return params;
  }
}

export const router = new Router(routes);
```

### 5.3 Navigation Groups in Sidebar

```
┌─────────────────────┐
│  🔄 FILE FLUX       │
├─────────────────────┤
│  MAIN               │
│  ▸ Dashboard        │
│  ▸ Jobs             │
│  ▸ Transfers        │
│  ▸ Agents           │
├─────────────────────┤
│  AUTOMATION         │
│  ▸ Workflows        │
│  ▸ Analytics        │
├─────────────────────┤
│  ADMINISTRATION     │
│  ▸ Tokens           │
│  ▸ Settings         │
└─────────────────────┘
```

---

## 6. State Management

### 6.1 Approach: Reactive Controller + Singleton Store

Lit provides **Reactive Controllers** — the idiomatic way to share state. We combine this with a lightweight reactive store pattern (no external library).

```typescript
// src/state/store.ts
type Listener = () => void;

export class ReactiveStore<T extends object> {
  private _state: T;
  private _listeners = new Set<Listener>();

  constructor(initial: T) {
    this._state = { ...initial };
  }

  get state(): Readonly<T> {
    return this._state;
  }

  setState(partial: Partial<T>): void {
    this._state = { ...this._state, ...partial };
    this._notify();
  }

  update(updater: (state: T) => Partial<T>): void {
    this.setState(updater(this._state));
  }

  subscribe(listener: Listener): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    this._listeners.forEach(l => l());
  }
}
```

### 6.2 Lit Reactive Controller for Store Binding

```typescript
// src/state/store-controller.ts
import { ReactiveControllerHost, ReactiveController } from 'lit';
import { ReactiveStore } from './store';

export class StoreController<T extends object> implements ReactiveController {
  private _unsubscribe?: () => void;

  constructor(
    private host: ReactiveControllerHost,
    private store: ReactiveStore<T>
  ) {
    host.addController(this);
  }

  get state(): Readonly<T> {
    return this.store.state;
  }

  hostConnected(): void {
    this._unsubscribe = this.store.subscribe(() => {
      this.host.requestUpdate();
    });
  }

  hostDisconnected(): void {
    this._unsubscribe?.();
  }
}
```

### 6.3 Store Slices

```typescript
// src/state/transfers.store.ts
import { ReactiveStore } from './store';
import type { Transfer, AsyncState } from '../types';

interface TransferState {
  list: AsyncState<Transfer[]>;
  active: Transfer[];
  selectedId: string | null;
  filters: {
    status: string;
    jobId: string;
    search: string;
    dateRange: [string, string] | null;
  };
  pagination: { page: number; pageSize: number; total: number };
}

export const transferStore = new ReactiveStore<TransferState>({
  list: { status: 'idle' },
  active: [],
  selectedId: null,
  filters: { status: 'all', jobId: 'all', search: '', dateRange: null },
  pagination: { page: 1, pageSize: 25, total: 0 },
});
```

### 6.4 Usage in a Component

```typescript
@customElement('ff-transfer-list-page')
export class TransferListPage extends LitElement {
  private _store = new StoreController(this, transferStore);

  render() {
    const { list, filters, pagination } = this._store.state;

    if (list.status === 'loading') return html`<ff-skeleton variant="table" />`;
    if (list.status === 'error') return html`<ff-empty-state icon="error" title="${list.error.message}" />`;
    if (list.status === 'success') {
      return html`
        <ff-page-header title="Transfers"></ff-page-header>
        <ff-data-table
          .columns=${this.columns}
          .data=${list.data}
          .pagination=${pagination}
          @sort-change=${this._onSort}
          @page-change=${this._onPage}
        ></ff-data-table>
      `;
    }
  }
}
```

---

## 7. SSE / Real-Time Integration

### 7.1 SSE Client

```typescript
// src/services/sse-client.ts
export type SSEEventType =
  | 'transfer:started'
  | 'transfer:progress'
  | 'transfer:completed'
  | 'transfer:failed'
  | 'agent:connected'
  | 'agent:disconnected'
  | 'agent:metrics'
  | 'job:started'
  | 'job:completed'
  | 'job:failed';

interface SSEEvent<T = unknown> {
  type: SSEEventType;
  timestamp: string;
  payload: T;
}

class SSEClient {
  private source: EventSource | null = null;
  private handlers = new Map<string, Set<(data: any) => void>>();
  private reconnectDelay = 1000;
  private maxReconnectDelay = 30000;

  connect(url: string, token: string): void {
    this.source = new EventSource(`${url}?token=${token}`);

    this.source.onopen = () => {
      this.reconnectDelay = 1000; // reset on success
    };

    this.source.onmessage = (event) => {
      try {
        const parsed: SSEEvent = JSON.parse(event.data);
        this._dispatch(parsed.type, parsed.payload);
        this._dispatch('*', parsed); // wildcard for activity stream
      } catch (e) {
        console.error('SSE parse error:', e);
      }
    };

    this.source.onerror = () => {
      this.source?.close();
      // Exponential backoff reconnect
      setTimeout(() => this.connect(url, token), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
    };
  }

  on<T>(event: SSEEventType | '*', handler: (data: T) => void): () => void {
    if (!this.handlers.has(event)) this.handlers.set(event, new Set());
    this.handlers.get(event)!.add(handler);
    return () => this.handlers.get(event)?.delete(handler);
  }

  disconnect(): void {
    this.source?.close();
    this.source = null;
  }

  private _dispatch(event: string, data: unknown): void {
    this.handlers.get(event)?.forEach(h => h(data));
  }
}

export const sseClient = new SSEClient();
```

### 7.2 SSE → Store Integration

```typescript
// In app.ts or a dedicated initializer
import { sseClient } from './services/sse-client';
import { transferStore } from './state/transfers.store';
import { agentStore } from './state/agents.store';
import { notificationStore } from './state/notifications.store';

function initSSE(token: string) {
  sseClient.connect('/api/events', token);

  sseClient.on<TransferProgressPayload>('transfer:progress', (data) => {
    transferStore.update(s => ({
      active: s.active.map(t =>
        t.id === data.transferId
          ? { ...t, progress: data.progress, speed: data.speed }
          : t
      ),
    }));
  });

  sseClient.on<TransferCompletedPayload>('transfer:completed', (data) => {
    notificationStore.addToast({
      type: 'success',
      title: 'Transfer Complete',
      message: `${data.filename} transferred successfully`,
    });
  });

  sseClient.on<AgentStatusPayload>('agent:disconnected', (data) => {
    notificationStore.addToast({
      type: 'warning',
      title: 'Agent Offline',
      message: `${data.agentName} lost connection`,
    });
  });
}
```

### 7.3 Activity Stream Component

```typescript
@customElement('ff-activity-stream')
export class ActivityStream extends LitElement {
  @state() private events: SSEEvent[] = [];
  private unsubscribe?: () => void;
  private maxEvents = 50;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = sseClient.on('*', (event: SSEEvent) => {
      this.events = [event, ...this.events].slice(0, this.maxEvents);
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  render() {
    return html`
      <ff-card>
        <h3 slot="header">Live Activity</h3>
        <ff-timeline .items=${this.events.map(e => ({
          icon: this._iconForEvent(e.type),
          title: this._titleForEvent(e),
          time: e.timestamp,
          status: this._statusForEvent(e.type),
        }))} />
      </ff-card>
    `;
  }
}
```

---

## 8. Charting Library

### Recommendation: **unovis** (formerly known as "vis")

| Criteria | unovis | Chart.js | Lightweight Charts |
|---|---|---|---|
| Bundle size | ~15KB per chart type | ~60KB | ~40KB |
| Web Component support | ✅ Native Lit wrappers | ❌ Canvas-only | ❌ |
| TypeScript | ✅ First-class | ✅ | ✅ |
| Chart types needed | Line, Bar, Donut, Gauge, Stacked Area | All | Financial only |
| SSR-friendly | SVG-based | Canvas | Canvas |
| Tree-shakeable | ✅ Per-component imports | ❌ | ✅ |

**Alternative:** If unovis is too niche, use **Chart.js** with a thin Lit wrapper (`<ff-chart>`). Chart.js is battle-tested and has every chart type needed.

### `<ff-chart>` Wrapper

```typescript
// src/components/ui/chart.ts
@customElement('ff-chart')
export class FfChart extends LitElement {
  @property({ type: String }) type: 'line' | 'bar' | 'doughnut' | 'radar' = 'line';
  @property({ type: Object }) data: ChartData = { labels: [], datasets: [] };
  @property({ type: Object }) options: ChartOptions = {};

  private chart: Chart | null = null;
  private canvas!: HTMLCanvasElement;

  firstUpdated() {
    this.canvas = this.renderRoot.querySelector('canvas')!;
    this._createChart();
  }

  updated(changed: PropertyValues) {
    if (changed.has('data') || changed.has('type')) {
      this.chart?.destroy();
      this._createChart();
    }
  }

  private _createChart() {
    this.chart = new Chart(this.canvas, {
      type: this.type,
      data: this.data,
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
        },
        ...this.options,
      },
    });
  }

  render() {
    return html`
      <div class="chart-container" style="position:relative; height:100%; min-height:200px;">
        <canvas></canvas>
      </div>
    `;
  }
}
```

Install: `npm install chart.js` (tree-shake by registering only needed controllers).

---

## 9. Shared Component Specifications

### 9.1 `<ff-data-table>`

The most critical shared component. Used in transfers, jobs, tokens, agents, audit log, analytics.

```typescript
interface Column<T = any> {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: any, row: T) => TemplateResult; // custom cell renderer
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  pageSizes?: number[];  // [10, 25, 50, 100]
}

// Usage:
html`
  <ff-data-table
    .columns=${[
      { key: 'name', label: 'Name', sortable: true },
      { key: 'status', label: 'Status', sortable: true,
        render: (val) => html`<ff-badge status="${val}">${val}</ff-badge>` },
      { key: 'createdAt', label: 'Created', sortable: true,
        render: (val) => html`${formatDate(val)}` },
    ]}
    .data=${transfers}
    .pagination=${{ page: 1, pageSize: 25, total: 150 }}
    .selectable=${true}
    @sort-change=${(e) => /* { key, direction } */}
    @page-change=${(e) => /* { page, pageSize } */}
    @row-click=${(e) => /* row data */}
    @selection-change=${(e) => /* selected row ids */}
  ></ff-data-table>
`;
```

**Events emitted:**
- `sort-change`: `{ detail: { key: string, direction: 'asc' | 'desc' } }`
- `page-change`: `{ detail: { page: number, pageSize: number } }`
- `row-click`: `{ detail: { row: T, index: number } }`
- `selection-change`: `{ detail: { selected: string[] } }`

### 9.2 `<ff-modal>`

```typescript
html`
  <ff-modal
    ?open=${this.showModal}
    title="Create Job"
    size="md"           <!-- sm | md | lg | xl | fullscreen -->
    @close=${() => this.showModal = false}
  >
    <form slot="body">...</form>
    <div slot="footer">
      <ff-button variant="ghost" @click=${this._cancel}>Cancel</ff-button>
      <ff-button variant="primary" @click=${this._save}>Save</ff-button>
    </div>
  </ff-modal>
`;
```

### 9.3 `<ff-toast-container>` + Notification Store

```typescript
// Notification store API:
notificationStore.addToast({
  type: 'success' | 'error' | 'warning' | 'info',
  title: 'Transfer Complete',
  message: 'file.zip uploaded successfully',
  duration: 5000,           // auto-dismiss
  action?: { label: 'View', callback: () => router.navigate('/transfers/123') }
});
```

Toast container rendered in app shell, absolutely positioned top-right.

### 9.4 `<ff-confirm-dialog>`

```typescript
// Global singleton pattern
const confirmed = await confirmDialog.show({
  title: 'Delete Job',
  message: 'This will permanently delete "Daily Backup". This action cannot be undone.',
  confirmLabel: 'Delete',
  confirmVariant: 'danger',
  cancelLabel: 'Cancel',
});
if (confirmed) { /* proceed */ }
```

### 9.5 `<ff-stat-card>`

```typescript
html`
  <ff-stat-card
    icon="swap_horiz"
    label="Active Transfers"
    value="23"
    trend="+12%"
    trendDirection="up"    <!-- up | down | flat -->
    trendPeriod="vs last week"
  ></ff-stat-card>
`;
```

### 9.6 `<ff-progress-bar>`

```typescript
html`
  <ff-progress-bar
    percent=${65}
    speed="8.2 MB/s"
    eta="12m 34s"
    status="running"       <!-- running | paused | completed | failed -->
    showLabel=${true}
  ></ff-progress-bar>
`;
```

### 9.7 `<ff-breadcrumb>`

```typescript
html`
  <ff-breadcrumb
    .items=${[
      { label: 'Jobs', href: '/jobs' },
      { label: 'Daily Backup', href: '/jobs/123' },
      { label: 'Run History' },
    ]}
  ></ff-breadcrumb>
`;
```

### 9.8 `<ff-empty-state>`

```typescript
html`
  <ff-empty-state
    icon="folder_off"
    title="No transfers yet"
    description="Create a job to start transferring files between agents."
  >
    <ff-button slot="action" variant="primary" @click=${this._createJob}>
      Create Job
    </ff-button>
  </ff-empty-state>
`;
```

---

## 10. Feature Component Specifications

### 10.1 Job Builder (`<ff-job-builder>`)

Visual source → destination flow editor.

```
┌──────────────────────────────────────────────────────────┐
│  Source                    ──►         Destination       │
│  ┌─────────────────┐      ──►    ┌─────────────────┐   │
│  │ Agent: prod-01  │     Flow    │ Agent: backup-01│   │
│  │ Path: /data/out │  ─────────► │ Path: /backup/  │   │
│  │ Pattern: *.csv  │             │                 │   │
│  └─────────────────┘             └─────────────────┘   │
│                                                          │
│  ┌── Options ────────────────────────────────────────┐  │
│  │ Type: Push   Compression: ✓   Chunk Size: 64MB   │  │
│  │ Schedule: Every day at 2:00 AM  [Edit Schedule]   │  │
│  │ Retry: 3 attempts, 5min backoff                   │  │
│  └───────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

**Props:** `jobId?: string` (edit mode), `readonly?: boolean`
**Events:** `job-save: { detail: Job }`, `job-cancel`

### 10.2 Cron Builder (`<ff-cron-builder>`)

```
┌────────────────────────────────────────────────────┐
│  Schedule: ○ Simple  ● Advanced                    │
│                                                    │
│  [Simple Mode]                                     │
│  Every: [Daily ▾]  at [02:00 ▾]                   │
│                                                    │
│  [Advanced Mode]                                   │
│  ┌──────┬──────┬──────┬───────┬─────┐             │
│  │ Min  │ Hour │ Day  │ Month │ DoW │             │
│  │ [0]  │ [2]  │ [*]  │ [*]   │ [*] │             │
│  └──────┴──────┴──────┴───────┴─────┘             │
│                                                    │
│  Expression: 0 2 * * *                             │
│  Next 5 runs:                                      │
│    • Feb 13, 2026 02:00                            │
│    • Feb 14, 2026 02:00                            │
│    • Feb 15, 2026 02:00                            │
│    ...                                             │
└────────────────────────────────────────────────────┘
```

**Props:** `value: string` (cron expression)
**Events:** `cron-change: { detail: { expression: string, nextRuns: Date[] } }`

### 10.3 Install Script Generator (`<ff-install-script>`)

```
┌────────────────────────────────────────────────────┐
│  Install Agent                                     │
│                                                    │
│  Platform: [Linux ▾] [Ubuntu/Debian ▾]            │
│                                                    │
│  ┌──────────────────────────────────────────┐     │
│  │ curl -sSL https://fileflux.io/install |  │ 📋  │
│  │ sudo bash -s -- \                        │     │
│  │   --server https://mft.company.com \     │     │
│  │   --token abc123def456                   │     │
│  └──────────────────────────────────────────┘     │
│                                                    │
│  ☑ Auto-start on boot                             │
│  ☑ Connect to server after install                │
└────────────────────────────────────────────────────┘
```

### 10.4 Workflow Editor (`<ff-workflow-editor>`)

SVG-based canvas with drag-and-drop nodes:

- **Node types:** Job, Condition, Delay, Notification, Parallel Gateway, End
- **Edges:** Directed arrows with labels (success/failure/always)
- **Canvas:** Pan, zoom (wheel), grid snap
- **Implementation:** SVG `<foreignObject>` for node content + SVG `<path>` for edges
- **Library consideration:** Use `@xyflow/svelte` ideas but implement natively in Lit with SVG, keeping the bundle minimal

### 10.5 Agent Health Panel (`<ff-agent-health-panel>`)

```
┌─────────────────────────────────────────────────┐
│  System Metrics          Last updated: 30s ago  │
│                                                  │
│  CPU          Memory         Disk                │
│  ┌────┐       ┌────┐        ┌────┐              │
│  │ 45%│       │ 72%│        │ 38%│              │
│  │ ◔  │       │ ◕  │        │ ◔  │              │
│  └────┘       └────┘        └────┘              │
│  4 cores      16 GB         500 GB              │
│                                                  │
│  Network I/O: ↑ 12 MB/s  ↓ 45 MB/s             │
│  Uptime: 23d 14h 32m                            │
│  Active Transfers: 3                             │
└─────────────────────────────────────────────────┘
```

---

## 11. Phased Implementation Plan

### Phase 0: Foundation (Week 1–2) — ~40 hours

| Task | Effort | Priority |
|---|---|---|
| Design tokens (`styles/tokens.ts`, `reset.ts`, `mixins.ts`) | 4h | P0 |
| TypeScript types (`types/*.ts`) | 4h | P0 |
| API client + demo service abstraction | 6h | P0 |
| Reactive store + store controller | 4h | P0 |
| Router refactor (declarative routes, lazy-load) | 6h | P0 |
| Icon system (`<ff-icon>`) | 2h | P0 |
| App shell refactor (`<ff-app-shell>`, new sidebar, header) | 8h | P0 |
| Install Inter + Material Symbols fonts | 1h | P0 |
| Dark mode token overrides | 3h | P1 |
| Keyboard shortcut registry | 2h | P1 |

**Deliverable:** New app shell with sidebar nav, header, router, tokens — all existing pages still work.

### Phase 1: UI Primitives (Week 3–4) — ~50 hours

| Component | Effort | Priority |
|---|---|---|
| `<ff-button>` (variants, sizes, loading, disabled) | 3h | P0 |
| `<ff-badge>` (status colors) | 1h | P0 |
| `<ff-card>` (slots: header, body, footer) | 2h | P0 |
| `<ff-stat-card>` (icon, value, trend) | 2h | P0 |
| `<ff-data-table>` (sort, filter, paginate, select, custom render) | 12h | P0 |
| `<ff-modal>` + `<ff-drawer>` | 4h | P0 |
| `<ff-toast-container>` + notification store | 4h | P0 |
| `<ff-confirm-dialog>` | 2h | P0 |
| `<ff-search-input>` (debounce) | 1h | P0 |
| `<ff-select>`, `<ff-text-input>`, `<ff-textarea>` | 4h | P0 |
| `<ff-form-field>` (label, error, helper) | 2h | P0 |
| `<ff-tabs>` + `<ff-tab-panel>` | 3h | P0 |
| `<ff-progress-bar>` | 2h | P0 |
| `<ff-skeleton>` (text, rect, table) | 2h | P0 |
| `<ff-empty-state>` | 1h | P0 |
| `<ff-breadcrumb>` | 1h | P0 |
| `<ff-avatar>` | 1h | P1 |
| `<ff-chip>` | 1h | P1 |
| `<ff-timeline>` | 2h | P1 |
| `<ff-tooltip>`, `<ff-dropdown>` | 3h | P1 |
| `<ff-code-block>` | 2h | P1 |
| `<ff-chart>` (Chart.js wrapper) | 4h | P0 |
| `<ff-toggle>`, `<ff-checkbox>` | 2h | P1 |

**Deliverable:** Complete UI primitive library. Every page can now be rebuilt using shared components.

### Phase 2: Core Pages Rebuild (Week 5–7) — ~60 hours

Rebuild existing pages using new primitives + store + router:

| Page | Effort | Priority |
|---|---|---|
| Dashboard page (stats, activity stream, throughput chart, agent grid) | 12h | P0 |
| Job list page (data-table, bulk actions, filters) | 6h | P0 |
| Job detail page (tabs, run history) | 6h | P0 |
| Job builder (source/dest visual editor) | 8h | P0 |
| Transfer list page (data-table, real-time progress rows) | 6h | P0 |
| Transfer detail page (progress, chunks, logs) | 6h | P0 |
| Agent list page (cards/table, health indicators) | 4h | P0 |
| Agent detail page (tabs, health panel, config) | 6h | P0 |
| Token list page (data-table, create modal) | 3h | P0 |
| Login page (redesign with illustration) | 3h | P1 |

**Deliverable:** All existing functionality rebuilt with consistent UX, real-time progress, shared components.

### Phase 3: SSE + Real-Time (Week 7–8) — ~25 hours

| Task | Effort | Priority |
|---|---|---|
| SSE client implementation | 4h | P0 |
| SSE → Store integration (transfers, agents) | 4h | P0 |
| Activity stream component | 4h | P0 |
| Real-time transfer progress bars | 4h | P0 |
| Agent heartbeat status updates | 3h | P0 |
| Toast notifications for events | 3h | P0 |
| Global search (`<ff-global-search>`, Cmd+K) | 3h | P1 |

**Deliverable:** Live dashboard, transfer progress, agent status, toast notifications.

### Phase 4: Advanced Job Features (Week 9–10) — ~35 hours

| Component | Effort | Priority |
|---|---|---|
| Cron builder (visual + preview) | 8h | P0 |
| Retry policy editor | 3h | P0 |
| File pattern input (glob tester) | 3h | P1 |
| Job run history table | 4h | P0 |
| Job dependency configuration | 4h | P1 |
| Job groups/folders | 4h | P1 |
| Job bulk actions toolbar | 3h | P1 |
| Agent registration wizard | 4h | P0 |
| Install script generator | 2h | P0 |

**Deliverable:** Enterprise-grade job management with scheduling, retries, history.

### Phase 5: Analytics & Reporting (Week 11–12) — ~30 hours

| Component | Effort | Priority |
|---|---|---|
| Analytics page layout | 3h | P0 |
| Transfer volume chart | 4h | P0 |
| Success/failure rate chart | 3h | P0 |
| Agent uptime chart | 3h | P1 |
| Job duration analysis | 3h | P1 |
| Data volume reports (daily/weekly/monthly) | 4h | P1 |
| CSV export | 3h | P0 |
| PDF export | 4h | P2 |
| Date range picker component | 3h | P0 |

**Deliverable:** Full analytics dashboard with exportable reports.

### Phase 6: Workflows & Admin (Week 13–16) — ~60 hours

| Component | Effort | Priority |
|---|---|---|
| Workflow editor canvas (SVG, pan, zoom) | 16h | P1 |
| Workflow node types + palette | 6h | P1 |
| Workflow edge drawing | 4h | P1 |
| Node properties panel | 4h | P1 |
| Workflow execution (run, monitor) | 6h | P1 |
| Workflow templates | 3h | P2 |
| Settings page (tabbed layout) | 3h | P0 |
| User management (RBAC table) | 6h | P1 |
| Webhook configuration | 3h | P1 |
| Notification rules builder | 4h | P2 |
| Audit log viewer | 3h | P1 |
| API key management | 2h | P1 |

**Deliverable:** Visual workflow builder, admin settings panel.

### Phase 7: Polish (Week 17–18) — ~20 hours

| Task | Effort | Priority |
|---|---|---|
| Keyboard shortcuts (Cmd+K search, navigation) | 3h | P1 |
| Dark mode complete testing | 3h | P1 |
| Responsive design (tablet breakpoints) | 4h | P1 |
| Loading states for every page | 2h | P0 |
| Error boundaries + fallback UI | 2h | P0 |
| Accessibility audit (keyboard nav, ARIA, contrast) | 4h | P0 |
| Performance audit (Lighthouse, bundle analysis) | 2h | P0 |

---

## Total Effort Summary

| Phase | Scope | Effort | Cumulative |
|---|---|---|---|
| Phase 0 | Foundation | 40h | 40h |
| Phase 1 | UI Primitives | 50h | 90h |
| Phase 2 | Core Pages | 60h | 150h |
| Phase 3 | Real-Time | 25h | 175h |
| Phase 4 | Advanced Jobs | 35h | 210h |
| Phase 5 | Analytics | 30h | 240h |
| Phase 6 | Workflows & Admin | 60h | 300h |
| Phase 7 | Polish | 20h | **320h** |

**MVP (Phases 0–3): ~175 hours** — Enterprise-level UX with real-time, shared components, proper architecture.

---

## 12. Testing Strategy

### Tools
- **Unit tests:** Vitest + `@open-wc/testing` (Lit component test helpers)
- **Visual regression:** Playwright component screenshots
- **E2E:** Playwright

### Test Structure
```
frontend/
├── src/
│   ├── components/ui/__tests__/
│   │   ├── data-table.test.ts
│   │   ├── modal.test.ts
│   │   └── ...
│   ├── state/__tests__/
│   │   ├── store.test.ts
│   │   └── transfers.store.test.ts
│   └── services/__tests__/
│       ├── api-client.test.ts
│       └── sse-client.test.ts
├── e2e/
│   ├── dashboard.spec.ts
│   ├── jobs.spec.ts
│   └── transfers.spec.ts
```

### Priority Tests
1. `<ff-data-table>` — sort, filter, paginate, select, render
2. `ReactiveStore` — setState, subscribe, update
3. `SSEClient` — connect, reconnect, dispatch
4. `Router` — match, navigate, lazy-load
5. `<ff-cron-builder>` — expression ↔ UI bidirectional

---

## 13. Performance Budget

| Metric | Target |
|---|---|
| Initial bundle (gzipped) | < 80 KB |
| LCP | < 1.5s |
| FID | < 50ms |
| CLS | < 0.05 |
| Route chunk size | < 30 KB each |
| Chart.js tree-shaken | < 25 KB |
| Lit runtime | ~7 KB |

### Optimization Techniques
- Route-based code splitting via dynamic `import()`
- Chart.js tree-shaking: register only needed chart types
- `requestAnimationFrame` for transfer progress updates (batch SSE)
- Virtual scrolling for transfer/audit log tables with 1000+ rows
- Preconnect to API server fonts: `<link rel="preconnect">`
- Service worker for caching static assets (Phase 7)

---

## Appendix: New npm Dependencies

```json
{
  "dependencies": {
    "lit": "^3.2.0",
    "chart.js": "^4.4.0"
  },
  "devDependencies": {
    "typescript": "^5.5.0",
    "vite": "^6.2.0",
    "@open-wc/testing": "^4.0.0",
    "vitest": "^2.0.0",
    "@vitest/browser": "^2.0.0",
    "playwright": "^1.48.0"
  }
}
```

No framework bloat. Lit + Chart.js = **< 70 KB gzipped** total runtime.
