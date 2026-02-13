/**
 * Tests für den Router-Service.
 *
 * Verifiziert:
 *   - Routen-Auflösung mit und ohne Parameter
 *   - Listener-Benachrichtigung
 *   - isActive-Logik
 *   - Unbekannte Routen (Fallback)
 *   - Unsubscribe
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Router, createAppRouter } from '../services/router';

describe('Router', () => {
  let router: Router;

  beforeEach(() => {
    router = new Router();
    router
      .addRoute('/')
      .addRoute('/jobs')
      .addRoute('/jobs/:id')
      .addRoute('/jobs/edit/:id')
      .addRoute('/agents')
      .addRoute('/agents/:id')
      .addRoute('/transfers')
      .addRoute('/transfers/:id')
      .addRoute('/tokens')
      .addRoute('/settings');
  });

  describe('resolve', () => {
    it('löst die Root-Route auf', () => {
      const route = router.resolve('/');
      expect(route.path).toBe('/');
      expect(route.params).toEqual({});
    });

    it('löst einfache Routen auf', () => {
      expect(router.resolve('/jobs').path).toBe('/jobs');
      expect(router.resolve('/agents').path).toBe('/agents');
      expect(router.resolve('/tokens').path).toBe('/tokens');
      expect(router.resolve('/settings').path).toBe('/settings');
    });

    it('extrahiert Parameter aus der URL', () => {
      const route = router.resolve('/jobs/42');
      expect(route.path).toBe('/jobs/:id');
      expect(route.params).toEqual({ id: '42' });
    });

    it('extrahiert Parameter bei verschachtelten Routen', () => {
      const route = router.resolve('/jobs/edit/99');
      expect(route.path).toBe('/jobs/edit/:id');
      expect(route.params).toEqual({ id: '99' });
    });

    it('gibt den Pfad zurück bei unbekannten Routen', () => {
      const route = router.resolve('/unbekannt');
      expect(route.path).toBe('/unbekannt');
      expect(route.params).toEqual({});
    });

    it('verarbeitet Transfer-Detail-Routen', () => {
      const route = router.resolve('/transfers/7');
      expect(route.path).toBe('/transfers/:id');
      expect(route.params).toEqual({ id: '7' });
    });
  });

  describe('onRouteChange', () => {
    it('benachrichtigt Listener bei Routenänderung', () => {
      const changes: string[] = [];
      router.onRouteChange(route => changes.push(route.path));

      router.resolve('/jobs');
      router.resolve('/agents');

      expect(changes).toEqual(['/jobs', '/agents']);
    });

    it('gibt eine Unsubscribe-Funktion zurück', () => {
      const changes: string[] = [];
      const unsub = router.onRouteChange(route => changes.push(route.path));

      router.resolve('/jobs');
      unsub();
      router.resolve('/agents');

      expect(changes).toEqual(['/jobs']);
    });

    it('unterstützt mehrere Listener', () => {
      let count = 0;
      router.onRouteChange(() => count++);
      router.onRouteChange(() => count++);

      router.resolve('/jobs');

      expect(count).toBe(2);
    });
  });

  describe('isActive', () => {
    it('erkennt exakte Übereinstimmung für Root', () => {
      router.resolve('/');
      expect(router.isActive('/')).toBe(true);
      expect(router.isActive('/jobs')).toBe(false);
    });

    it('erkennt Prefix-Übereinstimmung für Unterseiten', () => {
      router.resolve('/jobs/42');
      expect(router.isActive('/jobs')).toBe(true);
      expect(router.isActive('/agents')).toBe(false);
    });

    it('Root ist nicht aktiv bei Unterseiten', () => {
      router.resolve('/jobs');
      expect(router.isActive('/')).toBe(false);
    });
  });

  describe('getCurrentRoute', () => {
    it('gibt die aktuelle Route zurück', () => {
      router.resolve('/agents/5');
      const current = router.getCurrentRoute();
      expect(current.path).toBe('/agents/:id');
      expect(current.params.id).toBe('5');
    });

    it('hat Standard-Route vor resolve-Aufruf', () => {
      const current = router.getCurrentRoute();
      expect(current.path).toBe('/');
    });
  });
});

describe('createAppRouter', () => {
  it('erstellt einen Router mit allen FileFlux-Routen', () => {
    const router = createAppRouter();
    
    // Stichproben: Alle definierten Routen sollten auflösbar sein
    expect(router.resolve('/').path).toBe('/');
    expect(router.resolve('/jobs').path).toBe('/jobs');
    expect(router.resolve('/jobs/1').path).toBe('/jobs/:id');
    expect(router.resolve('/agents').path).toBe('/agents');
    expect(router.resolve('/transfers/5').path).toBe('/transfers/:id');
    expect(router.resolve('/settings').path).toBe('/settings');
  });
});
