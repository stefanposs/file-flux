/**
 * Tests für DemoDataSource.
 *
 * Verifiziert:
 *   - CRUD-Operationen für alle Entitäten
 *   - Seed-Daten werden korrekt geladen
 *   - Storage-Isolation durch MockStorage
 *   - Dashboard-Statistiken
 *   - Auth-Flow
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { DemoDataSource, StorageAdapter } from '../services/demo-data-source';

/** In-Memory Storage für Tests — kein localStorage nötig. */
class MockStorage implements StorageAdapter {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  /** Hilfsmethode für Tests. */
  clear(): void {
    this.data.clear();
  }
}

describe('DemoDataSource', () => {
  let ds: DemoDataSource;
  let storage: MockStorage;

  beforeEach(() => {
    storage = new MockStorage();
    ds = new DemoDataSource(storage);
  });

  // ── Auth ────────────────────────────────────────────────────────

  describe('Auth', () => {
    it('ist initial nicht authentifiziert', () => {
      expect(ds.isAuthenticated()).toBe(false);
    });

    it('setzt authentifiziert nach Login', async () => {
      await ds.login('test@test.de', 'password');
      expect(ds.isAuthenticated()).toBe(true);
    });

    it('login gibt LoginResponse zurück', async () => {
      const res = await ds.login('test@test.de', 'password');
      expect(res.token).toBe('demo-token');
      expect(res.user.email).toBe('demo@fileflux.de');
      expect(res.user.role).toBe('admin');
    });

    it('logout setzt authentifiziert zurück', async () => {
      await ds.login('test@test.de', 'pw');
      ds.logout();
      expect(ds.isAuthenticated()).toBe(false);
    });

    it('getCurrentUser gibt Demo-User zurück', async () => {
      const user = await ds.getCurrentUser();
      expect(user.name).toBe('Demo Admin');
      expect(user.email).toBe('demo@fileflux.de');
      expect(user.role).toBe('admin');
    });
  });

  // ── Agents ──────────────────────────────────────────────────────

  describe('Agents', () => {
    it('gibt Seed-Agenten zurück', async () => {
      const agents = await ds.getAgents();
      expect(agents.length).toBeGreaterThanOrEqual(3);
      expect(agents[0].name).toBe('Produktionsserver Berlin');
    });

    it('getAgent gibt einzelnen Agent zurück', async () => {
      const agent = await ds.getAgent(1);
      expect(agent.id).toBe(1);
      expect(agent.name).toBe('Produktionsserver Berlin');
    });

    it('getAgent wirft Fehler für unbekannte ID', async () => {
      await expect(ds.getAgent(999)).rejects.toThrow('Agent 999 nicht gefunden');
    });

    it('createAgent fügt neuen Agent hinzu', async () => {
      const agent = await ds.createAgent({ name: 'Test-Agent', type: 'server' });
      expect(agent.name).toBe('Test-Agent');
      expect(agent.type).toBe('server');
      expect(agent.status).toBe('offline');

      const agents = await ds.getAgents();
      expect(agents.some(a => a.name === 'Test-Agent')).toBe(true);
    });

    it('updateAgent ändert Agent-Daten', async () => {
      const updated = await ds.updateAgent(1, { name: 'Neuer Name' });
      expect(updated.name).toBe('Neuer Name');

      const agent = await ds.getAgent(1);
      expect(agent.name).toBe('Neuer Name');
    });

    it('deleteAgent entfernt Agent', async () => {
      await ds.deleteAgent(1);
      const agents = await ds.getAgents();
      expect(agents.some(a => a.id === 1)).toBe(false);
    });
  });

  // ── Jobs ────────────────────────────────────────────────────────

  describe('Jobs', () => {
    it('gibt Seed-Jobs zurück', async () => {
      const jobs = await ds.getJobs();
      expect(jobs.length).toBeGreaterThanOrEqual(3);
    });

    it('getJob gibt einzelnen Job zurück', async () => {
      const job = await ds.getJob(1);
      expect(job.name).toBe('Täglicher Datenaustausch');
    });

    it('createJob fügt neuen Job hinzu', async () => {
      const job = await ds.createJob({ name: 'Neuer Job', type: 'pull' });
      expect(job.name).toBe('Neuer Job');
      expect(job.status).toBe('active');
    });

    it('updateJob ändert Job-Daten', async () => {
      const updated = await ds.updateJob(1, { status: 'paused' });
      expect(updated.status).toBe('paused');
    });

    it('deleteJob entfernt Job', async () => {
      await ds.deleteJob(1);
      const jobs = await ds.getJobs();
      expect(jobs.some(j => j.id === 1)).toBe(false);
    });

    it('runJob aktualisiert last_run', async () => {
      await ds.runJob(1);
      const job = await ds.getJob(1);
      expect(job.last_run).not.toBeNull();
    });
  });

  // ── Transfers ───────────────────────────────────────────────────

  describe('Transfers', () => {
    it('gibt Seed-Transfers zurück', async () => {
      const transfers = await ds.getTransfers();
      expect(transfers.length).toBeGreaterThanOrEqual(4);
    });

    it('getTransfer gibt einzelnen Transfer zurück', async () => {
      const transfer = await ds.getTransfer(1);
      expect(transfer.filename).toBe('export-2025-02-12.tar.gz');
    });

    it('cancelTransfer setzt Status auf cancelled', async () => {
      await ds.cancelTransfer(3);
      const transfer = await ds.getTransfer(3);
      expect(transfer.status).toBe('cancelled');
    });
  });

  // ── Tokens ──────────────────────────────────────────────────────

  describe('Tokens', () => {
    it('gibt Seed-Tokens zurück', async () => {
      const tokens = await ds.getTokens();
      expect(tokens.length).toBeGreaterThanOrEqual(3);
    });

    it('createToken erstellt Token mit Wert', async () => {
      const result = await ds.createToken({ name: 'Test-Token', agent_id: 1 });
      expect(result.token.name).toBe('Test-Token');
      expect(result.value).toMatch(/^fft_/);
    });

    it('revokeToken entfernt Token', async () => {
      await ds.revokeToken(1);
      const tokens = await ds.getTokens();
      expect(tokens.some(t => t.id === 1)).toBe(false);
    });
  });

  // ── Dashboard ───────────────────────────────────────────────────

  describe('Dashboard', () => {
    it('berechnet korrekte Statistiken', async () => {
      const stats = await ds.getDashboardStats();
      expect(stats.totalTransfers).toBeGreaterThanOrEqual(4);
      expect(stats.completedTransfers).toBeGreaterThanOrEqual(2);
      expect(stats.failedTransfers).toBeGreaterThanOrEqual(1);
      expect(stats.activeAgents).toBeGreaterThanOrEqual(2);
      expect(stats.totalJobs).toBeGreaterThanOrEqual(3);
    });
  });

  // ── Health ──────────────────────────────────────────────────────

  describe('Health', () => {
    it('gibt Demo-Health zurück', async () => {
      const health = await ds.health();
      expect(health.status).toBe('ok');
      expect(health.version).toBe('1.0.0-demo');
    });
  });

  // ── Storage-Persistenz ──────────────────────────────────────────

  describe('Storage', () => {
    it('persistiert Änderungen im Storage', async () => {
      await ds.createAgent({ name: 'Persist-Test' });

      // Neue DataSource mit demselben Storage
      const ds2 = new DemoDataSource(storage);
      const agents = await ds2.getAgents();
      expect(agents.some(a => a.name === 'Persist-Test')).toBe(true);
    });

    it('verschiedene Storage-Instanzen sind isoliert', async () => {
      const storage2 = new MockStorage();
      const ds2 = new DemoDataSource(storage2);

      await ds.deleteAgent(1);

      // ds2 hat noch alle Seed-Daten
      const agent = await ds2.getAgent(1);
      expect(agent.id).toBe(1);
    });
  });
});
