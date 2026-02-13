/**
 * <ff-confirm-dialog> — Bestätigungsdialog.
 *
 * Modale Bestätigungs-Box für destruktive Aktionen
 * (Löschen, Widerrufen, etc.).
 *
 * @example
 *   <ff-confirm-dialog
 *     ?open=${this.showDeleteDialog}
 *     title="Agent löschen?"
 *     message="Der Agent 'Berlin' wird unwiderruflich entfernt."
 *     confirmLabel="Löschen"
 *     type="danger"
 *     @confirm=${this._deleteAgent}
 *     @cancel=${() => this.showDeleteDialog = false}
 *   ></ff-confirm-dialog>
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ff-confirm-dialog')
export class ConfirmDialog extends LitElement {
  @property({ type: Boolean, reflect: true }) open = false;
  @property({ type: String }) title = 'Bestätigung';
  @property({ type: String }) message = '';
  @property({ type: String }) confirmLabel = 'Bestätigen';
  @property({ type: String }) cancelLabel = 'Abbrechen';
  @property({ type: String }) type: 'danger' | 'warning' | 'default' = 'default';

  static styles = css`
    :host {
      display: none;
    }

    :host([open]) {
      display: block;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      animation: fadeIn 0.15s ease;
    }

    .dialog {
      background: white;
      border-radius: var(--ff-radius-lg, 12px);
      box-shadow: var(--ff-shadow-lg, 0 10px 15px -3px rgba(0,0,0,0.1));
      padding: 24px;
      max-width: 420px;
      width: 90%;
      animation: slideIn 0.2s ease;
    }

    .title {
      font-size: 17px;
      font-weight: 600;
      color: var(--ff-gray-900, #111827);
      margin: 0 0 8px;
    }

    .message {
      font-size: 14px;
      color: var(--ff-gray-600, #4b5563);
      line-height: 1.5;
      margin: 0 0 20px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    button {
      padding: 8px 16px;
      border-radius: var(--ff-radius-sm, 6px);
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s, transform 0.1s;
      border: 1px solid var(--ff-border, #e5e7eb);
    }

    button:active {
      transform: scale(0.98);
    }

    .cancel-btn {
      background: white;
      color: var(--ff-gray-700, #374151);
    }

    .cancel-btn:hover {
      background: var(--ff-gray-50, #f9fafb);
    }

    .confirm-btn {
      border: none;
      color: white;
    }

    .confirm-btn.default {
      background: var(--ff-primary, #4f46e5);
    }
    .confirm-btn.default:hover {
      background: var(--ff-primary-hover, #4338ca);
    }

    .confirm-btn.danger {
      background: var(--ff-error, #ef4444);
    }
    .confirm-btn.danger:hover {
      background: #dc2626;
    }

    .confirm-btn.warning {
      background: var(--ff-warning, #f59e0b);
    }
    .confirm-btn.warning:hover {
      background: #d97706;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideIn {
      from { transform: scale(0.95); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
  `;

  render() {
    if (!this.open) return html``;

    return html`
      <div class="overlay" @click=${this._handleOverlayClick}>
        <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
          <h3 class="title">${this.title}</h3>
          <p class="message">${this.message}</p>
          <div class="actions">
            <button class="cancel-btn" @click=${this._cancel}>${this.cancelLabel}</button>
            <button class="confirm-btn ${this.type}" @click=${this._confirm}>${this.confirmLabel}</button>
          </div>
        </div>
      </div>
    `;
  }

  private _handleOverlayClick() {
    this._cancel();
  }

  private _confirm() {
    this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
    this.open = false;
  }

  private _cancel() {
    this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
    this.open = false;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ff-confirm-dialog': ConfirmDialog;
  }
}
