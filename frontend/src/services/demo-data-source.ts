/**
 * DemoDataSource — Implementierung von DataSource mit lokalen Demo-Daten.
 *
 * Arbeitet komplett ohne Backend.
 * Daten werden in localStorage persistiert, sodass Änderungen
 * auch nach einem Reload erhalten bleiben.
 *
 * Testbar: Kann mit einem eigenen Storage-Mock instanziert werden.
 */

import type { DataSource } from './data-source';
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

// ── Storage-Abstraktion (für Tests mockbar) ──────────────────────────

export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

// ── Seed-Daten ──────────────────────────────────────────────────────

function seedAgents(): Agent[] {
  return [
    {
      id: 1, name: 'Produktionsserver Berlin', type: 'client', status: 'online',
      ip_address: '10.0.1.10', system: 'Ubuntu 22.04 LTS', version: '1.2.0',
      last_seen: new Date().toISOString(), description: 'Haupt-Dateiserver Berlin',
      created_at: '2024-11-15T08:00:00Z',
    },
    {
      id: 2, name: 'Backup-Server München', type: 'server', status: 'online',
      ip_address: '10.0.2.20', system: 'Debian 12', version: '1.2.0',
      last_seen: new Date().toISOString(), description: 'Zentrales Backup München',
      created_at: '2024-11-20T10:30:00Z',
    },
    {
      id: 3, name: 'Staging Hamburg', type: 'client', status: 'offline',
      ip_address: '10.0.3.30', system: 'Windows Server 2022', version: '1.1.5',
      last_seen: '2025-02-10T14:22:00Z', description: 'Staging-Umgebung',
      created_at: '2024-12-01T09:00:00Z',
    },
  ];
}

function seedJobs(): Job[] {
  return [
    {
      id: 1, user_id: 1, name: 'Täglicher Datenaustausch', type: 'push',
      status: 'active', schedule: '0 2 * * *',
      source_path: '/data/export/', destination_path: '/backup/daily/',
      source_agent_id: 1, destination_agent_id: 2,
      last_run: '2025-02-12T02:00:00Z', next_run: '2025-02-13T02:00:00Z',
      description: 'Tägliche Sicherung der Exportdaten', created_at: '2024-12-01T10:00:00Z',
    },
    {
      id: 2, user_id: 1, name: 'Wöchentliches Backup', type: 'push',
      status: 'active', schedule: '0 3 * * 0',
      source_path: '/var/log/', destination_path: '/archive/logs/',
      source_agent_id: 1, destination_agent_id: 2,
      last_run: '2025-02-09T03:00:00Z', next_run: '2025-02-16T03:00:00Z',
      description: 'Wöchentliche Log-Archivierung', created_at: '2024-12-05T11:00:00Z',
    },
    {
      id: 3, user_id: 1, name: 'Staging-Sync', type: 'pull',
      status: 'paused', schedule: null,
      source_path: '/release/build/', destination_path: '/staging/deploy/',
      source_agent_id: 2, destination_agent_id: 3,
      last_run: null, next_run: null,
      description: 'Manueller Deploy auf Staging', created_at: '2025-01-10T08:00:00Z',
    },
  ];
}

function seedTransfers(): Transfer[] {
  const now = new Date();
  return [
    {
      id: 1, job_id: 1, filename: 'export-2025-02-12.tar.gz', size: 524288000,
      status: 'completed', progress: 100,
      source_path: '/data/export/export-2025-02-12.tar.gz',
      destination_path: '/backup/daily/export-2025-02-12.tar.gz',
      source_agent_id: 1, destination_agent_id: 2,
      start_time: '2025-02-12T02:00:10Z', end_time: '2025-02-12T02:05:43Z',
      error: null, created_at: '2025-02-12T02:00:10Z',
    },
    {
      id: 2, job_id: 1, filename: 'export-2025-02-11.tar.gz', size: 498073600,
      status: 'completed', progress: 100,
      source_path: '/data/export/export-2025-02-11.tar.gz',
      destination_path: '/backup/daily/export-2025-02-11.tar.gz',
      source_agent_id: 1, destination_agent_id: 2,
      start_time: '2025-02-11T02:00:08Z', end_time: '2025-02-11T02:04:55Z',
      error: null, created_at: '2025-02-11T02:00:08Z',
    },
    {
      id: 3, job_id: null, filename: 'report-q4.pdf', size: 2097152,
      status: 'running', progress: 67,
      source_path: '/data/reports/report-q4.pdf',
      destination_path: '/backup/reports/report-q4.pdf',
      source_agent_id: 1, destination_agent_id: 2,
      start_time: new Date(now.getTime() - 120_000).toISOString(), end_time: null,
      error: null, created_at: new Date(now.getTime() - 120_000).toISOString(),
    },
    {
      id: 4, job_id: 2, filename: 'syslog-20250209.gz', size: 104857600,
      status: 'failed', progress: 42,
      source_path: '/var/log/syslog-20250209.gz',
      destination_path: '/archive/logs/syslog-20250209.gz',
      source_agent_id: 1, destination_agent_id: 2,
      start_time: '2025-02-09T03:00:05Z', end_time: '2025-02-09T03:02:18Z',
      error: 'Verbindung zum Zielserver unterbrochen', created_at: '2025-02-09T03:00:05Z',
    },
  ];
}

function seedTokens(): Token[] {
  return [
    {
      id: 1, agent_id: 1, name: 'Produktions-Token Berlin',
      value: 'fft_prod_***', created_at: '2024-11-15T08:10:00Z',
      expires_at: '2025-11-15T08:10:00Z', last_used: new Date().toISOString(),
      description: 'Haupttoken für Produktionsserver',
    },
    {
      id: 2, agent_id: 2, name: 'Backup-Token München',
      value: 'fft_backup_***', created_at: '2024-11-20T10:35:00Z',
      expires_at: '2025-11-20T10:35:00Z', last_used: '2025-02-12T02:05:43Z',
      description: 'Token für Backup-Server',
    },
    {
      id: 3, agent_id: 3, name: 'Staging-Token (abgelaufen)',
      value: 'fft_staging_***', created_at: '2024-06-01T09:00:00Z',
      expires_at: '2025-01-01T09:00:00Z', last_used: '2024-12-15T11:00:00Z',
      description: 'Abgelaufenes Token für Staging',
    },
  ];
}

// ── Hilfsfunktionen ─────────────────────────────────────────────────

let nextId = 100;

function generateId(): number {
  return nextId++;
}

// ── DemoDataSource ──────────────────────────────────────────────────

export class DemoDataSource implements DataSource {
  readonly name = 'demo';

  private authenticated = false;
  private storage: StorageAdapter;

  constructor(storage: StorageAdapter = localStorage) {
    this.storage = storage;
    this.initSeedData();
  }

  /** Seed-Daten einmalig anlegen, wenn noch nicht vorhanden. */
  private initSeedData(): void {
    if (!this.storage.getItem('demo_agents')) {
      this.storage.setItem('demo_agents', JSON.stringify(seedAgents()));
    }
    if (!this.storage.getItem('demo_jobs')) {
      this.storage.setItem('demo_jobs', JSON.stringify(seedJobs()));
    }
    if (!this.storage.getItem('demo_transfers')) {
      this.storage.setItem('demo_transfers', JSON.stringify(seedTransfers()));
    }
    if (!this.storage.getItem('demo_tokens')) {
      this.storage.setItem('demo_tokens', JSON.stringify(seedTokens()));
    }
  }

  private load<T>(key: string): T[] {
    const raw = this.storage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  }

  private save<T>(key: string, data: T[]): void {
    this.storage.setItem(key, JSON.stringify(data));
  }

  // ── Auth ──────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    return this.authenticated;
  }

  async login(_email: string, _password: string): Promise<LoginResponse> {
    await this.delay(300);
    this.authenticated = true;
    return {
      token: 'demo-token',
      expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      user: { id: 1, name: 'Demo Admin', email: 'demo@fileflux.de', role: 'admin' },
    };
  }

  logout(): void {
    this.authenticated = false;
  }

  async getCurrentUser(): Promise<User> {
    await this.delay(100);
    return {
      id: '1', name: 'Demo Admin', email: 'demo@fileflux.de',
      role: 'admin', avatar: null, lastLogin: new Date().toISOString(),
    };
  }

  async changePassword(_current: string, _next: string): Promise<void> {
    await this.delay(200);
  }

  // ── Agents ────────────────────────────────────────────────────────

  async getAgents(): Promise<Agent[]> {
    await this.delay(150);
    return this.load<Agent>('demo_agents');
  }

  async getAgent(id: number): Promise<Agent> {
    await this.delay(100);
    const agents = this.load<Agent>('demo_agents');
    const agent = agents.find(a => a.id === id);
    if (!agent) throw new Error(`Agent ${id} nicht gefunden`);
    return agent;
  }

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    await this.delay(200);
    const agents = this.load<Agent>('demo_agents');
    const agent: Agent = {
      id: generateId(),
      name: data.name || 'Neuer Agent',
      type: data.type || 'client',
      status: 'offline',
      ip_address: null,
      system: null,
      version: null,
      last_seen: null,
      description: data.description || null,
      created_at: new Date().toISOString(),
    };
    agents.push(agent);
    this.save('demo_agents', agents);
    return agent;
  }

  async updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
    await this.delay(200);
    const agents = this.load<Agent>('demo_agents');
    const idx = agents.findIndex(a => a.id === id);
    if (idx === -1) throw new Error(`Agent ${id} nicht gefunden`);
    agents[idx] = { ...agents[idx], ...data };
    this.save('demo_agents', agents);
    return agents[idx];
  }

  async deleteAgent(id: number): Promise<void> {
    await this.delay(200);
    const agents = this.load<Agent>('demo_agents').filter(a => a.id !== id);
    this.save('demo_agents', agents);
  }

  // ── Jobs ──────────────────────────────────────────────────────────

  async getJobs(): Promise<Job[]> {
    await this.delay(150);
    return this.load<Job>('demo_jobs');
  }

  async getJob(id: number): Promise<Job> {
    await this.delay(100);
    const jobs = this.load<Job>('demo_jobs');
    const job = jobs.find(j => j.id === id);
    if (!job) throw new Error(`Job ${id} nicht gefunden`);
    return job;
  }

  async createJob(data: Partial<Job>): Promise<Job> {
    await this.delay(200);
    const jobs = this.load<Job>('demo_jobs');
    const job: Job = {
      id: generateId(),
      user_id: 1,
      name: data.name || 'Neuer Job',
      type: data.type || 'push',
      status: 'active',
      schedule: data.schedule || null,
      source_path: data.source_path || '/source/',
      destination_path: data.destination_path || '/dest/',
      source_agent_id: data.source_agent_id || 1,
      destination_agent_id: data.destination_agent_id || 2,
      last_run: null,
      next_run: null,
      description: data.description || null,
      created_at: new Date().toISOString(),
    };
    jobs.push(job);
    this.save('demo_jobs', jobs);
    return job;
  }

  async updateJob(id: number, data: Partial<Job>): Promise<Job> {
    await this.delay(200);
    const jobs = this.load<Job>('demo_jobs');
    const idx = jobs.findIndex(j => j.id === id);
    if (idx === -1) throw new Error(`Job ${id} nicht gefunden`);
    jobs[idx] = { ...jobs[idx], ...data };
    this.save('demo_jobs', jobs);
    return jobs[idx];
  }

  async deleteJob(id: number): Promise<void> {
    await this.delay(200);
    const jobs = this.load<Job>('demo_jobs').filter(j => j.id !== id);
    this.save('demo_jobs', jobs);
  }

  async runJob(id: number): Promise<void> {
    await this.delay(300);
    const jobs = this.load<Job>('demo_jobs');
    const idx = jobs.findIndex(j => j.id === id);
    if (idx !== -1) {
      jobs[idx].last_run = new Date().toISOString();
      this.save('demo_jobs', jobs);
    }
  }

  // ── Transfers ─────────────────────────────────────────────────────

  async getTransfers(): Promise<Transfer[]> {
    await this.delay(150);
    return this.load<Transfer>('demo_transfers');
  }

  async getTransfer(id: number): Promise<Transfer> {
    await this.delay(100);
    const transfers = this.load<Transfer>('demo_transfers');
    const transfer = transfers.find(t => t.id === id);
    if (!transfer) throw new Error(`Transfer ${id} nicht gefunden`);
    return transfer;
  }

  async cancelTransfer(id: number): Promise<void> {
    await this.delay(200);
    const transfers = this.load<Transfer>('demo_transfers');
    const idx = transfers.findIndex(t => t.id === id);
    if (idx !== -1) {
      transfers[idx].status = 'cancelled';
      this.save('demo_transfers', transfers);
    }
  }

  // ── Tokens ────────────────────────────────────────────────────────

  async getTokens(): Promise<Token[]> {
    await this.delay(150);
    return this.load<Token>('demo_tokens');
  }

  async createToken(data: { name: string; agent_id: number }): Promise<CreateTokenResponse> {
    await this.delay(200);
    const tokens = this.load<Token>('demo_tokens');
    const id = generateId();
    const value = `fft_${Math.random().toString(36).slice(2, 14)}`;
    const token: Token = {
      id,
      agent_id: data.agent_id,
      name: data.name,
      value: `${value.slice(0, 8)}***`,
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(),
      last_used: null,
      description: null,
    };
    tokens.push(token);
    this.save('demo_tokens', tokens);
    return { token, value };
  }

  async revokeToken(id: number): Promise<void> {
    await this.delay(200);
    const tokens = this.load<Token>('demo_tokens').filter(t => t.id !== id);
    this.save('demo_tokens', tokens);
  }

  // ── Dashboard ─────────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    const [transfers, agents, jobs] = await Promise.all([
      this.getTransfers(),
      this.getAgents(),
      this.getJobs(),
    ]);

    return {
      totalTransfers: transfers.length,
      completedTransfers: transfers.filter(t => t.status === 'completed').length,
      failedTransfers: transfers.filter(t => t.status === 'failed').length,
      activeAgents: agents.filter(a => a.status === 'online').length,
      totalJobs: jobs.length,
    };
  }

  // ── Health ────────────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    await this.delay(50);
    return {
      status: 'ok',
      version: '1.0.0-demo',
      components: { database: 'demo', api: 'demo' },
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
