/**
 * <ff-empty-state> — Leerer Zustand mit Illustration und CTA.
 *
 * Wird angezeigt, wenn eine Liste/Tabelle keine Einträge hat.
 * Konsistentes Erscheinungsbild über alle Seiten.
 *
 * @example
 *   <ff-empty-state
 *     icon="📋"
 *     title="Keine Jobs vorhanden"
 *     description="Erstellen Sie einen neuen Job, um Dateiübertragungen zu automatisieren."
 *     actionLabel="Neuen Job erstellen"
 *     @action=${this._createJob}
 *   ></ff-empty-state>
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ff-empty-state')
export class EmptyState extends LitElement {
  @property({ type: String }) icon = '📄';
  @property({ type: String }) title = '';
  @property({ type: String }) description = '';
  @property({ type: String }) actionLabel = '';

  static styles = css`
    :host {
      display: block;
    }

    .container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 24px;
      text-align: center;
    }

    .icon {
      width: 64px;
      height: 64px;
      border-radius: 16px;
      background: var(--ff-primary-light, #eef2ff);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      margin-bottom: 16px;
    }

    .title {
      font-size: 18px;
      font-weight: 600;
      color: var(--ff-gray-800, #1f2937);
      margin: 0 0 8px;
    }

    .description {
      font-size: 14px;
      color: var(--ff-gray-500, #6b7280);
      max-width: 360px;
      line-height: 1.5;
      margin: 0 0 20px;
    }

    .action-button {
      background: var(--ff-primary, #4f46e5);
      color: white;
      border: none;
      border-radius: var(--ff-radius-sm, 6px);
      padding: 10px 20px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: background var(--ff-transition, 0.2s ease);
    }

    .action-button:hover {
      background: var(--ff-primary-hover, #4338ca);
    }

    .action-button:active {
      transform: scale(0.98);
    }
  `;

  render() {
    return html`
      <div class="container">
        <div class="icon">${this.icon}</div>
        ${this.title ? html`<h3 class="title">${this.title}</h3>` : ''}
        ${this.description ? html`<p class="description">${this.description}</p>` : ''}
        ${this.actionLabel ? html`
          <button class="action-button" @click=${this._handleAction}>
            ${this.actionLabel}
          </button>
        ` : ''}
      </div>
    `;
  }

  private _handleAction() {
    this.dispatchEvent(new CustomEvent('action', { bubbles: true, composed: true }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ff-empty-state': EmptyState;
  }
}
