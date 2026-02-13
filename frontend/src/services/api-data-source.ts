/**
 * ApiDataSource — Implementierung von DataSource gegen das echte Backend.
 *
 * Kapselt den bestehenden ApiService und mappt die Antworten
 * auf die standardisierten Domain-Typen.
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

// ── HTTP-Fehler ──────────────────────────────────────────────────────

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// ── ApiDataSource ────────────────────────────────────────────────────

export class ApiDataSource implements DataSource {
  readonly name = 'api';

  private token: string | null = null;
  private refreshTimer: number | null = null;
  private readonly baseUrl: string;
  private readonly tokenKey: string;
  private readonly userKey: string;

  constructor(
    baseUrl = '/api',
    tokenKey = 'ff_auth_token',
    userKey = 'ff_auth_user',
  ) {
    this.baseUrl = baseUrl;
    this.tokenKey = tokenKey;
    this.userKey = userKey;
    try {
      this.token = localStorage.getItem(this.tokenKey);
    } catch {
      this.token = null;
    }
  }

  // ── Auth ──────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    return !!this.token;
  }

  async login(email: string, password: string): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
    });
    this.setAuth(res);
    return res;
  }

  async refreshAuthToken(): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/auth/refresh', {
      method: 'POST',
    });
    this.setAuth(res);
    return res;
  }

  async getCurrentUser(): Promise<User> {
    const apiUser = await this.request<{ id: number; name: string; email: string; role: string }>('/auth/user');
    return {
      id: String(apiUser.id),
      name: apiUser.name || apiUser.email,
      email: apiUser.email,
      role: apiUser.role,
      avatar: null,
    };
  }

  logout(): void {
    this.token = null;
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await this.request('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    });
  }

  // ── Agents ────────────────────────────────────────────────────────

  async getAgents(): Promise<Agent[]> {
    return (await this.request<Agent[]>('/agents')) || [];
  }

  async getAgent(id: number): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`);
  }

  async createAgent(data: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id: number, data: Partial<Agent>): Promise<Agent> {
    return this.request<Agent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: number): Promise<void> {
    await this.request(`/agents/${id}`, { method: 'DELETE' });
  }

  // ── Jobs ──────────────────────────────────────────────────────────

  async getJobs(): Promise<Job[]> {
    return (await this.request<Job[]>('/jobs')) || [];
  }

  async getJob(id: number): Promise<Job> {
    return this.request<Job>(`/jobs/${id}`);
  }

  async createJob(data: Partial<Job>): Promise<Job> {
    return this.request<Job>('/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJob(id: number, data: Partial<Job>): Promise<Job> {
    return this.request<Job>(`/jobs/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJob(id: number): Promise<void> {
    await this.request(`/jobs/${id}`, { method: 'DELETE' });
  }

  async runJob(id: number): Promise<void> {
    await this.request(`/jobs/${id}/run`, { method: 'POST' });
  }

  // ── Transfers ─────────────────────────────────────────────────────

  async getTransfers(): Promise<Transfer[]> {
    return (await this.request<Transfer[]>('/transfers')) || [];
  }

  async getTransfer(id: number): Promise<Transfer> {
    return this.request<Transfer>(`/transfers/${id}`);
  }

  async cancelTransfer(id: number): Promise<void> {
    await this.request(`/transfers/${id}/cancel`, { method: 'POST' });
  }

  // ── Tokens ────────────────────────────────────────────────────────

  async getTokens(): Promise<Token[]> {
    return (await this.request<Token[]>('/tokens')) || [];
  }

  async createToken(data: { name: string; agent_id: number }): Promise<CreateTokenResponse> {
    return this.request<CreateTokenResponse>('/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeToken(id: number): Promise<void> {
    await this.request(`/tokens/${id}`, { method: 'DELETE' });
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
    const res = await fetch('/health');
    return res.json();
  }

  // ── Interner HTTP-Client ──────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit & { skipAuth?: boolean } = {},
  ): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string> || {}),
    };

    if (!skipAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      let errorData: { error: string; code?: string };
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}`, code: `HTTP_${response.status}` };
      }

      if (response.status === 401 && !skipAuth) {
        this.logout();
        document.dispatchEvent(new CustomEvent('ff-auth-expired'));
      }

      throw new ApiRequestError(errorData.error, response.status, errorData.code);
    }

    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json();
  }

  private setAuth(res: LoginResponse): void {
    this.token = res.token;
    localStorage.setItem(this.tokenKey, res.token);
    localStorage.setItem(this.userKey, JSON.stringify(res.user));

    const expiresAt = new Date(res.expires_at).getTime();
    const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000;
    if (refreshIn > 0) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        this.refreshAuthToken().catch(() => this.logout());
      }, refreshIn);
    }
  }
}
