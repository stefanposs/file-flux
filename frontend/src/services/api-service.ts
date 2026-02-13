/**
 * FileFlux API Service — zentraler HTTP-Client mit Auth-Header-Injection,
 * Token-Refresh, und standardisiertem Error-Handling.
 */

export interface ApiError {
  error: string;
  code?: string;
  details?: string;
}

export interface LoginResponse {
  token: string;
  expires_at: string;
  user: ApiUser;
}

export interface ApiUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

export interface ApiAgent {
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

export interface ApiJob {
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

export interface ApiTransfer {
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

export interface ApiToken {
  id: number;
  agent_id: number;
  name: string;
  value: string;
  created_at: string;
  expires_at: string | null;
  last_used: string | null;
  description: string | null;
}

export interface HealthResponse {
  status: string;
  version: string;
  components: {
    database: string;
    api: string;
  };
}

const API_BASE = '/api';
const TOKEN_KEY = 'ff_auth_token';
const USER_KEY = 'ff_auth_user';

class ApiService {
  private token: string | null = null;
  private refreshTimer: number | null = null;

  constructor() {
    this.token = localStorage.getItem(TOKEN_KEY);
  }

  // ── Auth ──────────────────────────────────────────────────────────

  isAuthenticated(): boolean {
    return !!this.token;
  }

  getStoredUser(): ApiUser | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  getToken(): string | null {
    return this.token;
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

  async refreshToken(): Promise<LoginResponse> {
    const res = await this.request<LoginResponse>('/auth/refresh', {
      method: 'POST',
    });
    this.setAuth(res);
    return res;
  }

  async getCurrentUser(): Promise<ApiUser> {
    return this.request<ApiUser>('/auth/user');
  }

  logout() {
    this.token = null;
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  private setAuth(res: LoginResponse) {
    this.token = res.token;
    localStorage.setItem(TOKEN_KEY, res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));

    // Auto-refresh 5 Minuten vor Ablauf
    const expiresAt = new Date(res.expires_at).getTime();
    const refreshIn = expiresAt - Date.now() - 5 * 60 * 1000;
    if (refreshIn > 0) {
      if (this.refreshTimer) clearTimeout(this.refreshTimer);
      this.refreshTimer = window.setTimeout(() => {
        this.refreshToken().catch(() => this.logout());
      }, refreshIn);
    }
  }

  // ── Agents ────────────────────────────────────────────────────────

  async getAgents(): Promise<ApiAgent[]> {
    return (await this.request<ApiAgent[]>('/agents')) || [];
  }

  async getAgent(id: number): Promise<ApiAgent> {
    return this.request<ApiAgent>(`/agents/${id}`);
  }

  async createAgent(data: Partial<ApiAgent>): Promise<ApiAgent> {
    return this.request<ApiAgent>('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id: number): Promise<void> {
    await this.request(`/agents/${id}`, { method: 'DELETE' });
  }

  async updateAgent(id: number, data: Partial<ApiAgent>): Promise<ApiAgent> {
    return this.request<ApiAgent>(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ── Jobs ──────────────────────────────────────────────────────────

  async getJobs(): Promise<ApiJob[]> {
    return (await this.request<ApiJob[]>('/jobs')) || [];
  }

  async getJob(id: number): Promise<ApiJob> {
    return this.request<ApiJob>(`/jobs/${id}`);
  }

  async createJob(data: Partial<ApiJob>): Promise<ApiJob> {
    return this.request<ApiJob>('/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJob(id: number, data: Partial<ApiJob>): Promise<ApiJob> {
    return this.request<ApiJob>(`/jobs/${id}`, {
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

  async getTransfers(): Promise<ApiTransfer[]> {
    return (await this.request<ApiTransfer[]>('/transfers')) || [];
  }

  async getTransfer(id: number): Promise<ApiTransfer> {
    return this.request<ApiTransfer>(`/transfers/${id}`);
  }

  async cancelTransfer(id: number): Promise<void> {
    await this.request(`/transfers/${id}/cancel`, { method: 'POST' });
  }

  // ── Tokens ────────────────────────────────────────────────────────

  async getTokens(): Promise<ApiToken[]> {
    return (await this.request<ApiToken[]>('/tokens')) || [];
  }

  async createToken(data: { name: string; agent_id: number }): Promise<ApiToken> {
    return this.request<ApiToken>('/tokens', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async revokeToken(id: number): Promise<void> {
    await this.request(`/tokens/${id}`, { method: 'DELETE' });
  }

  // ── Health ────────────────────────────────────────────────────────

  async health(): Promise<HealthResponse> {
    const res = await fetch('/health');
    return res.json();
  }

  // ── Generic Request ───────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit & { skipAuth?: boolean } = {}
  ): Promise<T> {
    const { skipAuth, ...fetchOptions } = options;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(fetchOptions.headers as Record<string, string> || {}),
    };

    if (!skipAuth && this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${path}`, {
      ...fetchOptions,
      headers,
    });

    if (!response.ok) {
      let errorData: ApiError;
      try {
        errorData = await response.json();
      } catch {
        errorData = { error: `HTTP ${response.status}`, code: `HTTP_${response.status}` };
      }

      // 401 → Token abgelaufen → Logout
      if (response.status === 401 && !skipAuth) {
        this.logout();
        document.dispatchEvent(new CustomEvent('ff-auth-expired'));
      }

      throw new ApiRequestError(errorData.error, response.status, errorData.code);
    }

    // 204 No Content
    if (response.status === 204) {
      return undefined as unknown as T;
    }

    return response.json();
  }
}

export class ApiRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

// Singleton-Instanz
export const api = new ApiService();
