/**
 * Router — Testbarer, deklarativer SPA-Router.
 *
 * Entkoppelt vom DOM: Arbeitet mit einem Callback-Muster,
 * sodass Tests ohne Browser-History-API auskommen.
 *
 * Funktionsweise:
 *   1. Definiere Routen mit Parametern: `/jobs/:id`
 *   2. Der Router parst die URL und gibt Route + Params zurück
 *   3. Änderungen werden über einen Callback gemeldet
 */

import type { Route } from '../types';

export type RouteChangeCallback = (route: Route) => void;

interface RouteDefinition {
  pattern: string;
  segments: string[];
  paramNames: string[];
}

export class Router {
  private routes: RouteDefinition[] = [];
  private listeners: RouteChangeCallback[] = [];
  private currentRoute: Route = { path: '/', params: {} };
  private popstateHandler: (() => void) | null = null;

  /**
   * Registriert eine Route.
   * Segmente mit `:` sind Parameter: `/jobs/:id` → { id: '123' }
   */
  addRoute(pattern: string): this {
    const segments = pattern.split('/').filter(Boolean);
    const paramNames = segments
      .filter(s => s.startsWith(':'))
      .map(s => s.slice(1));

    this.routes.push({ pattern, segments, paramNames });
    return this;
  }

  /**
   * Registriert einen Listener für Routenänderungen.
   */
  onRouteChange(callback: RouteChangeCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  /**
   * Gibt die aktuelle Route zurück.
   */
  getCurrentRoute(): Route {
    return this.currentRoute;
  }

  /**
   * Bindet sich an die Browser-History-API.
   * Muss nicht aufgerufen werden, wenn der Router
   * nur programmatisch genutzt wird (Tests).
   */
  listen(): void {
    this.popstateHandler = () => this.resolve(window.location.pathname);
    window.addEventListener('popstate', this.popstateHandler);
    this.resolve(window.location.pathname);
  }

  /**
   * Entfernt den Browser-History-Listener.
   */
  unlisten(): void {
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
      this.popstateHandler = null;
    }
  }

  /**
   * Navigiert programmatisch zu einem Pfad.
   */
  navigate(path: string): void {
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', path);
    }
    this.resolve(path);
  }

  /**
   * Löst einen Pfad auf und benachrichtigt Listener.
   * Kann auch direkt in Tests aufgerufen werden.
   */
  resolve(path: string): Route {
    const pathSegments = path.split('/').filter(Boolean);

    for (const route of this.routes) {
      const match = this.matchRoute(route, pathSegments);
      if (match) {
        this.currentRoute = match;
        this.notifyListeners();
        return match;
      }
    }

    // Fallback: unbekannte Route
    this.currentRoute = { path, params: {} };
    this.notifyListeners();
    return this.currentRoute;
  }

  /**
   * Prüft, ob ein Pfad zur aktuellen Route gehört (für aktive Nav-Links).
   */
  isActive(path: string): boolean {
    if (path === '/') return this.currentRoute.path === '/';
    return this.currentRoute.path.startsWith(path);
  }

  // ── Internes ──────────────────────────────────────────────────────

  private matchRoute(def: RouteDefinition, pathSegments: string[]): Route | null {
    if (def.segments.length !== pathSegments.length) return null;

    const params: Record<string, string> = {};

    for (let i = 0; i < def.segments.length; i++) {
      const routeSeg = def.segments[i];
      const pathSeg = pathSegments[i];

      if (routeSeg.startsWith(':')) {
        params[routeSeg.slice(1)] = pathSeg;
      } else if (routeSeg !== pathSeg) {
        return null;
      }
    }

    return { path: def.pattern, params };
  }

  private notifyListeners(): void {
    for (const listener of this.listeners) {
      listener(this.currentRoute);
    }
  }
}

// ── Vorkonfigurierte Instanz mit allen FileFlux-Routen ──────────────

export function createAppRouter(): Router {
  const router = new Router();
  router
    .addRoute('/')
    .addRoute('/jobs')
    .addRoute('/jobs/:id')
    .addRoute('/jobs/edit/:id')
    .addRoute('/agents')
    .addRoute('/agents/:id')
    .addRoute('/agents/edit/:id')
    .addRoute('/tokens')
    .addRoute('/transfers')
    .addRoute('/transfers/:id')
    .addRoute('/settings');
  return router;
}
