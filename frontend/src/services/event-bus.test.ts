/**
 * Tests für den EventBus.
 *
 * Verifiziert:
 *   - Event-Emission und -Empfang
 *   - Typsichere Payloads
 *   - Unsubscribe
 *   - once-Listener
 *   - Fehler-Isolation
 *   - clear
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventBus } from '../services/event-bus';

describe('EventBus', () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  describe('on / emit', () => {
    it('ruft registrierte Listener auf', () => {
      const handler = vi.fn();
      bus.on('toast', handler);

      bus.emit('toast', { message: 'Test', type: 'success' });

      expect(handler).toHaveBeenCalledWith({ message: 'Test', type: 'success' });
    });

    it('unterstützt mehrere Listener für dasselbe Event', () => {
      const h1 = vi.fn();
      const h2 = vi.fn();
      bus.on('toast', h1);
      bus.on('toast', h2);

      bus.emit('toast', { message: 'Test', type: 'info' });

      expect(h1).toHaveBeenCalledOnce();
      expect(h2).toHaveBeenCalledOnce();
    });

    it('ruft keine Listener für andere Events auf', () => {
      const handler = vi.fn();
      bus.on('toast', handler);

      bus.emit('auth:logout', undefined as any);

      expect(handler).not.toHaveBeenCalled();
    });

    it('tut nichts wenn keine Listener registriert sind', () => {
      // Sollte keinen Fehler werfen
      expect(() => {
        bus.emit('toast', { message: 'Test', type: 'error' });
      }).not.toThrow();
    });
  });

  describe('unsubscribe', () => {
    it('entfernt Listener über Unsubscribe-Funktion', () => {
      const handler = vi.fn();
      const unsub = bus.on('toast', handler);

      bus.emit('toast', { message: '1', type: 'info' });
      unsub();
      bus.emit('toast', { message: '2', type: 'info' });

      expect(handler).toHaveBeenCalledOnce();
    });
  });

  describe('once', () => {
    it('ruft Listener nur einmal auf', () => {
      const handler = vi.fn();
      bus.once('toast', handler);

      bus.emit('toast', { message: '1', type: 'info' });
      bus.emit('toast', { message: '2', type: 'info' });

      expect(handler).toHaveBeenCalledOnce();
      expect(handler).toHaveBeenCalledWith({ message: '1', type: 'info' });
    });
  });

  describe('clear', () => {
    it('entfernt alle Listener', () => {
      const handler = vi.fn();
      bus.on('toast', handler);
      bus.on('auth:logout', vi.fn());

      bus.clear();

      bus.emit('toast', { message: 'Test', type: 'info' });
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('listenerCount', () => {
    it('gibt die Anzahl der Listener zurück', () => {
      expect(bus.listenerCount('toast')).toBe(0);

      bus.on('toast', vi.fn());
      expect(bus.listenerCount('toast')).toBe(1);

      bus.on('toast', vi.fn());
      expect(bus.listenerCount('toast')).toBe(2);
    });

    it('aktualisiert sich bei Unsubscribe', () => {
      const unsub = bus.on('toast', vi.fn());
      expect(bus.listenerCount('toast')).toBe(1);

      unsub();
      expect(bus.listenerCount('toast')).toBe(0);
    });
  });

  describe('Fehler-Isolation', () => {
    it('fängt Fehler in Handlern ab ohne andere zu beeinflussen', () => {
      const errorHandler = vi.fn(() => { throw new Error('Boom'); });
      const goodHandler = vi.fn();

      bus.on('toast', errorHandler);
      bus.on('toast', goodHandler);

      // Sollte keinen Fehler werfen
      expect(() => {
        bus.emit('toast', { message: 'Test', type: 'info' });
      }).not.toThrow();

      // Zweiter Handler wird trotzdem aufgerufen
      expect(goodHandler).toHaveBeenCalledOnce();
    });
  });
});
