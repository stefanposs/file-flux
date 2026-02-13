/**
 * <ff-loading-spinner> — Einheitlicher Lade-Indikator.
 *
 * Ersetzt die bisher in jeder Komponente duplizierte Spinner-CSS.
 *
 * @example
 *   <ff-loading-spinner></ff-loading-spinner>
 *   <ff-loading-spinner size="small" label="Daten werden geladen…"></ff-loading-spinner>
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ff-loading-spinner')
export class LoadingSpinner extends LitElement {
  @property({ type: String }) size: 'small' | 'medium' | 'large' = 'medium';
  @property({ type: String }) label = '';

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 24px;
    }

    .spinner {
      border: 3px solid var(--ff-gray-200, #e5e7eb);
      border-left-color: var(--ff-primary, #4f46e5);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }

    .spinner.small {
      width: 24px;
      height: 24px;
      border-width: 2px;
    }

    .spinner.medium {
      width: 40px;
      height: 40px;
    }

    .spinner.large {
      width: 56px;
      height: 56px;
      border-width: 4px;
    }

    .label {
      font-size: 14px;
      color: var(--ff-gray-500, #6b7280);
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `;

  render() {
    return html`
      <div class="spinner ${this.size}"></div>
      ${this.label ? html`<span class="label">${this.label}</span>` : ''}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ff-loading-spinner': LoadingSpinner;
  }
}
