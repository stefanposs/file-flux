/**
 * <ff-breadcrumb> — Breadcrumb-Navigation.
 *
 * Zeigt den aktuellen Pfad in der Anwendung an.
 * Ermöglicht schnelle Navigation zu übergeordneten Seiten.
 *
 * @example
 *   <ff-breadcrumb .items=${[
 *     { label: 'Jobs', path: '/jobs' },
 *     { label: 'Täglicher Datenaustausch' }
 *   ]}></ff-breadcrumb>
 */

import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export interface BreadcrumbItem {
  label: string;
  path?: string;
}

@customElement('ff-breadcrumb')
export class Breadcrumb extends LitElement {
  @property({ type: Array }) items: BreadcrumbItem[] = [];

  static styles = css`
    :host {
      display: block;
      margin-bottom: 16px;
    }

    nav {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: var(--ff-gray-500, #6b7280);
    }

    .home-link {
      color: var(--ff-gray-400, #9ca3af);
      text-decoration: none;
      cursor: pointer;
      display: flex;
      align-items: center;
    }

    .home-link:hover {
      color: var(--ff-primary, #4f46e5);
    }

    .separator {
      color: var(--ff-gray-300, #d1d5db);
      user-select: none;
    }

    .link {
      color: var(--ff-gray-500, #6b7280);
      text-decoration: none;
      cursor: pointer;
      transition: color var(--ff-transition, 0.2s ease);
    }

    .link:hover {
      color: var(--ff-primary, #4f46e5);
    }

    .current {
      color: var(--ff-gray-800, #1f2937);
      font-weight: 500;
    }
  `;

  render() {
    return html`
      <nav aria-label="Breadcrumb">
        <a class="home-link" @click=${() => this._navigate('/')}>
          <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.707 2.293a1 1 0 00-1.414 0l-7 7a1 1 0 001.414 1.414L4 10.414V17a1 1 0 001 1h2a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h2a1 1 0 001-1v-6.586l.293.293a1 1 0 001.414-1.414l-7-7z"/>
          </svg>
        </a>
        ${this.items.map((item, index) => html`
          <span class="separator">›</span>
          ${item.path && index < this.items.length - 1
            ? html`<a class="link" @click=${() => this._navigate(item.path!)}>${item.label}</a>`
            : html`<span class="current">${item.label}</span>`
          }
        `)}
      </nav>
    `;
  }

  private _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path },
      bubbles: true,
      composed: true,
    }));
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ff-breadcrumb': Breadcrumb;
  }
}
