/**
 * <ff-status-badge> — Wiederverwendbare Status-Anzeige.
 *
 * Zeigt einen farbigen Badge basierend auf dem Status-Wert.
 * Wird für Agents (online/offline), Transfers (running/completed/failed),
 * Jobs (active/paused) und Tokens (active/expired) verwendet.
 *
 * @example
 *   <ff-status-badge status="online"></ff-status-badge>
 *   <ff-status-badge status="failed" label="Fehlgeschlagen"></ff-status-badge>
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

const STATUS_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  // Agent
  online:    { color: '#059669', bg: '#ecfdf5', label: 'Online' },
  offline:   { color: '#6b7280', bg: '#f3f4f6', label: 'Offline' },
  // Transfer
  completed: { color: '#059669', bg: '#ecfdf5', label: 'Abgeschlossen' },
  running:   { color: '#2563eb', bg: '#eff6ff', label: 'Wird ausgeführt' },
  pending:   { color: '#d97706', bg: '#fffbeb', label: 'Ausstehend' },
  failed:    { color: '#dc2626', bg: '#fef2f2', label: 'Fehlgeschlagen' },
  cancelled: { color: '#6b7280', bg: '#f3f4f6', label: 'Abgebrochen' },
  // Job
  active:    { color: '#059669', bg: '#ecfdf5', label: 'Aktiv' },
  inactive:  { color: '#6b7280', bg: '#f3f4f6', label: 'Inaktiv' },
  paused:    { color: '#d97706', bg: '#fffbeb', label: 'Pausiert' },
  disabled:  { color: '#6b7280', bg: '#f3f4f6', label: 'Deaktiviert' },
  // Token
  expired:   { color: '#dc2626', bg: '#fef2f2', label: 'Abgelaufen' },
  revoked:   { color: '#6b7280', bg: '#f3f4f6', label: 'Widerrufen' },
};

@customElement('ff-status-badge')
export class StatusBadge extends LitElement {
  @property({ type: String }) status = '';
  @property({ type: String }) label = '';

  static styles = css`
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 600;
      line-height: 1.4;
      white-space: nowrap;
    }

    .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      flex-shrink: 0;
    }
  `;

  render() {
    const config = STATUS_CONFIG[this.status] || { color: '#6b7280', bg: '#f3f4f6', label: this.status };
    const displayLabel = this.label || config.label;

    return html`
      <span class="badge" style="color: ${config.color}; background: ${config.bg};">
        <span class="dot" style="background: ${config.color};"></span>
        ${displayLabel}
      </span>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ff-status-badge': StatusBadge;
  }
}
