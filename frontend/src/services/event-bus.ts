/**
 * EventBus — Typsicherer, testbarer Event-Bus.
 *
 * Ersetzt die bisherigen verstreuten CustomEvent-Dispatches.
 * Alle Komponenten kommunizieren über diesen zentralen Bus.
 *
 * Vorteile:
 *   - Testbar: `bus.emit('toast', ...)` statt `document.dispatchEvent(new CustomEvent(...))`
 *   - Typsicher: Events und Payloads sind typisiert
 *   - Entkoppelt: Kein DOM-Zugriff nötig
 */

import type { ToastType } from '../types';

// ── Event-Typen und Payloads ────────────────────────────────────────

export interface EventMap {
  'toast': { message: string; type: ToastType; duration?: number };
  'auth:expired': void;
  'auth:login': { email: string; password: string };
  'auth:logout': void;
  'navigate': { path: string };
}

export type EventName = keyof EventMap;

type Listener<T> = (payload: T) => void;

// ── EventBus ────────────────────────────────────────────────────────

export class EventBus {
  private listeners = new Map<string, Set<Listener<any>>>();

  /**
   * Registriert einen Listener für ein Event.
   * Gibt eine Unsubscribe-Funktion zurück.
   */
  on<K extends EventName>(event: K, listener: Listener<EventMap[K]>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);

    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  /**
   * Registriert einen Listener, der nur einmal aufgerufen wird.
   */
  once<K extends EventName>(event: K, listener: Listener<EventMap[K]>): () => void {
    const wrapper: Listener<EventMap[K]> = (payload) => {
      unsub();
      listener(payload);
    };
    const unsub = this.on(event, wrapper);
    return unsub;
  }

  /**
   * Sendet ein Event an alle registrierten Listener.
   */
  emit<K extends EventName>(event: K, payload: EventMap[K]): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      try {
        handler(payload);
      } catch (err) {
        console.error(`[EventBus] Fehler in Handler für "${event}":`, err);
      }
    }
  }

  /**
   * Entfernt alle Listener (für Tests / Cleanup).
   */
  clear(): void {
    this.listeners.clear();
  }

  /**
   * Gibt die Anzahl der Listener für ein Event zurück (für Tests).
   */
  listenerCount(event: EventName): number {
    return this.listeners.get(event)?.size ?? 0;
  }
}

// ── Singleton-Instanz ───────────────────────────────────────────────

export const eventBus = new EventBus();
