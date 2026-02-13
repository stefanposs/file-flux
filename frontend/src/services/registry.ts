/**
 * ServiceRegistry — Zentrales Dependency-Injection-Register.
 *
 * Stellt sicher, dass jede Komponente dieselbe Instanz der Services nutzt.
 * Für Tests kann das gesamte Registry durch ein Mock ersetzt werden.
 *
 * Verwendung in Komponenten:
 *   import { getDataSource } from '../services/registry';
 *   const ds = getDataSource();
 *   const agents = await ds.getAgents();
 *
 * Verwendung in Tests:
 *   import { setDataSource } from '../services/registry';
 *   setDataSource(new MockDataSource());
 */

import type { DataSource } from './data-source';
import { ApiDataSource } from './api-data-source';
import { DemoDataSource } from './demo-data-source';

// ── Singleton-Instanz ───────────────────────────────────────────────

let dataSource: DataSource | null = null;
let demoModeActive = false;

/**
 * Prüft, ob Demo-Modus aktiv ist (URL-Parameter oder localStorage).
 */
export function isDemoMode(): boolean {
  if (demoModeActive) return true;

  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('demo') === 'true') {
        localStorage.setItem('demoMode', 'true');
        demoModeActive = true;
        return true;
      }
      if (localStorage.getItem('demoMode') === 'true') {
        demoModeActive = true;
        return true;
      }
    } catch {
      // localStorage nicht verfügbar (z.B. in Tests)
    }
  }

  return false;
}

/**
 * Aktiviert den Demo-Modus programmatisch.
 */
export function activateDemoMode(): void {
  try { localStorage.setItem('demoMode', 'true'); } catch { /* noop */ }
  demoModeActive = true;
  dataSource = new DemoDataSource();
}

/**
 * Deaktiviert den Demo-Modus.
 */
export function deactivateDemoMode(): void {
  try { localStorage.removeItem('demoMode'); } catch { /* noop */ }
  demoModeActive = false;
  dataSource = new ApiDataSource();
}

/**
 * Gibt die aktive DataSource zurück.
 * Im Demo-Modus → DemoDataSource, sonst → ApiDataSource.
 */
export function getDataSource(): DataSource {
  if (!dataSource) {
    dataSource = isDemoMode()
      ? new DemoDataSource()
      : new ApiDataSource();
  }
  return dataSource;
}

/**
 * Ersetzt die aktive DataSource (für Tests oder dynamisches Umschalten).
 */
export function setDataSource(ds: DataSource): void {
  dataSource = ds;
}

/**
 * Setzt das Registry zurück (für Tests).
 */
export function resetRegistry(): void {
  dataSource = null;
  demoModeActive = false;
}
