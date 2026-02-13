/**
 * DataSource — Abstraktes Interface für alle Datenoperationen.
 *
 * Jede Komponente arbeitet nur gegen dieses Interface.
 * Es gibt zwei Implementierungen:
 *   1. ApiDataSource  — Echte Backend-Anbindung (api-service.ts)
 *   2. DemoDataSource — Lokale Demo-Daten (demo-mode.ts)
 *
 * Das macht die Anwendung testbar (Mock-DataSource),
 * wartbar (klar definierter Vertrag) und ersetzbar (neue Backends).
 */

import type {
  User,
  Agent,
  Job,
  Transfer,
  Token,
  CreateTokenResponse,
  LoginResponse,
  DashboardStats,
  HealthResponse,
} from '../types';

export interface DataSource {
  readonly name: string;

  // ── Auth ────────────────────────────────────────────────────────
  isAuthenticated(): boolean;
  login(email: string, password: string): Promise<LoginResponse>;
  logout(): void;
  getCurrentUser(): Promise<User>;
  changePassword(currentPassword: string, newPassword: string): Promise<void>;

  // ── Agents ──────────────────────────────────────────────────────
  getAgents(): Promise<Agent[]>;
  getAgent(id: number): Promise<Agent>;
  createAgent(data: Partial<Agent>): Promise<Agent>;
  updateAgent(id: number, data: Partial<Agent>): Promise<Agent>;
  deleteAgent(id: number): Promise<void>;

  // ── Jobs ────────────────────────────────────────────────────────
  getJobs(): Promise<Job[]>;
  getJob(id: number): Promise<Job>;
  createJob(data: Partial<Job>): Promise<Job>;
  updateJob(id: number, data: Partial<Job>): Promise<Job>;
  deleteJob(id: number): Promise<void>;
  runJob(id: number): Promise<void>;

  // ── Transfers ───────────────────────────────────────────────────
  getTransfers(): Promise<Transfer[]>;
  getTransfer(id: number): Promise<Transfer>;
  cancelTransfer(id: number): Promise<void>;

  // ── Tokens ──────────────────────────────────────────────────────
  getTokens(): Promise<Token[]>;
  createToken(data: { name: string; agent_id: number }): Promise<CreateTokenResponse>;
  revokeToken(id: number): Promise<void>;

  // ── Dashboard ───────────────────────────────────────────────────
  getDashboardStats(): Promise<DashboardStats>;

  // ── Health ──────────────────────────────────────────────────────
  health(): Promise<HealthResponse>;
}
