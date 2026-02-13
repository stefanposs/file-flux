/**
 * FileFlux — Zentrale Typdefinitionen
 *
 * Alle Domain-Modelle an einem Ort.
 * Kein Modul importiert Typen aus Komponenten oder Services direkt —
 * alles kommt aus dieser Datei.
 */

// ── Benutzer ────────────────────────────────────────────────────────

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  lastLogin?: string;
}

// ── Agent ───────────────────────────────────────────────────────────

export interface Agent {
  id: number;
  name: string;
  type: string;
  status: string;
  ip_address: string | null;
  system: string | null;
  version: string | null;
  last_seen: string | null;
  description: string | null;
  created_at: string;
}

// ── Job ─────────────────────────────────────────────────────────────

export interface Job {
  id: number;
  user_id: number;
  name: string;
  type: string;
  status: string;
  schedule: string | null;
  source_path: string;
  destination_path: string;
  source_agent_id: number;
  destination_agent_id: number;
  last_run: string | null;
  next_run: string | null;
  description: string | null;
  created_at: string;
}

// ── Transfer ────────────────────────────────────────────────────────

export interface Transfer {
  id: number;
  job_id: number | null;
  filename: string;
  size: number;
  status: string;
  progress: number;
  source_path: string;
  destination_path: string;
  source_agent_id: number | null;
  destination_agent_id: number | null;
  start_time: string;
  end_time: string | null;
  error: string | null;
  created_at: string;
}

// ── Token ───────────────────────────────────────────────────────────

export interface Token {
  id: number;
  agent_id: number;
  name: string;
  value: string;
  created_at: string;
  expires_at: string | null;
  last_used: string | null;
  description: string | null;
}

export interface CreateTokenResponse {
  token: Token;
  value: string;
}

// ── Auth ────────────────────────────────────────────────────────────

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: { id: number; name: string; email: string; role: string };
}

// ── Dashboard ───────────────────────────────────────────────────────

export interface DashboardStats {
  totalTransfers: number;
  completedTransfers: number;
  failedTransfers: number;
  activeAgents: number;
  totalJobs: number;
}

// ── Health ──────────────────────────────────────────────────────────

export interface HealthResponse {
  status: string;
  version: string;
  components: { database: string; api: string };
}

// ── Routing ─────────────────────────────────────────────────────────

export interface Route {
  path: string;
  params: Record<string, string>;
}

// ── Toast / Benachrichtigungen ──────────────────────────────────────

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

// ── Sidebar-Navigation ─────────────────────────────────────────────

export interface NavItem {
  label: string;
  path: string;
  icon: string;
  section?: string;
}
