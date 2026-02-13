/**
 * Tests für das Service-Registry.
 *
 * Verifiziert:
 *   - Default-DataSource basierend auf Demo-Modus
 *   - Manual setDataSource / resetRegistry
 *   - isDemoMode-Erkennung
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getDataSource,
  setDataSource,
  resetRegistry,
} from '../services/registry';
import type { DataSource } from '../services/data-source';

// Mock-DataSource für Tests
function createMockDataSource(name = 'mock'): DataSource {
  return {
    name,
    isAuthenticated: vi.fn(() => false),
    login: vi.fn(),
    logout: vi.fn(),
    getCurrentUser: vi.fn(),
    changePassword: vi.fn(),
    getAgents: vi.fn(async () => []),
    getAgent: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    getJobs: vi.fn(async () => []),
    getJob: vi.fn(),
    createJob: vi.fn(),
    updateJob: vi.fn(),
    deleteJob: vi.fn(),
    runJob: vi.fn(),
    getTransfers: vi.fn(async () => []),
    getTransfer: vi.fn(),
    cancelTransfer: vi.fn(),
    getTokens: vi.fn(async () => []),
    createToken: vi.fn(),
    revokeToken: vi.fn(),
    getDashboardStats: vi.fn(),
    health: vi.fn(),
  } as DataSource;
}

describe('ServiceRegistry', () => {
  beforeEach(() => {
    resetRegistry();
  });

  describe('getDataSource', () => {
    it('gibt immer dieselbe Instanz zurück (Singleton)', () => {
      const ds1 = getDataSource();
      const ds2 = getDataSource();
      expect(ds1).toBe(ds2);
    });

    it('erstellt ApiDataSource wenn kein Demo-Modus', () => {
      const ds = getDataSource();
      expect(ds.name).toBe('api');
    });
  });

  describe('setDataSource', () => {
    it('überschreibt die DataSource', () => {
      const mock = createMockDataSource('test-mock');
      setDataSource(mock);

      expect(getDataSource().name).toBe('test-mock');
    });
  });

  describe('resetRegistry', () => {
    it('setzt die DataSource zurück', () => {
      const mock = createMockDataSource();
      setDataSource(mock);
      resetRegistry();

      // Nach Reset wird eine neue Instanz erstellt
      expect(getDataSource()).not.toBe(mock);
    });
  });
});
