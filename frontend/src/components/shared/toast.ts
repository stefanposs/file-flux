import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'warning' | 'info';
}

let toastCounter = 0;

/**
 * Global toast notification component.
 * Usage: document.dispatchEvent(new CustomEvent('ff-toast', { detail: { text: 'Done!', type: 'success' } }));
 */
@customElement('ff-toast-container')
export class ToastContainer extends LitElement {
  @state() private toasts: ToastMessage[] = [];

  static styles = css`
    :host {
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 10000;
      display: flex;
      flex-direction: column;
      gap: 8px;
      pointer-events: none;
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      color: white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      pointer-events: auto;
      cursor: pointer;
      animation: slideIn 0.3s ease-out;
      max-width: 400px;
    }

    .toast.removing {
      animation: slideOut 0.3s ease-in forwards;
    }

    .toast-success {
      background-color: #059669;
    }

    .toast-error {
      background-color: #dc2626;
    }

    .toast-warning {
      background-color: #d97706;
    }

    .toast-info {
      background-color: #2563eb;
    }

    .toast-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }
  `;

  private _boundHandler = this._handleToast.bind(this);

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('ff-toast', this._boundHandler as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('ff-toast', this._boundHandler as EventListener);
  }

  private _handleToast(e: CustomEvent) {
    const { text, type = 'info' } = e.detail;
    const id = ++toastCounter;
    this.toasts = [...this.toasts, { id, text, type }];

    // Auto-dismiss after 4 seconds
    setTimeout(() => this._dismiss(id), 4000);
  }

  private _dismiss(id: number) {
    this.toasts = this.toasts.filter(t => t.id !== id);
  }

  private _getIcon(type: string): string {
    switch (type) {
      case 'success': return '✓';
      case 'error': return '✕';
      case 'warning': return '⚠';
      case 'info': return 'ℹ';
      default: return 'ℹ';
    }
  }

  render() {
    return html`
      ${this.toasts.map(toast => html`
        <div
          class="toast toast-${toast.type}"
          @click=${() => this._dismiss(toast.id)}
        >
          <span class="toast-icon">${this._getIcon(toast.type)}</span>
          <span>${toast.text}</span>
        </div>
      `)}
    `;
  }
}

/**
 * Helper function to show a toast notification.
 * Import and call: showToast('Job erstellt!', 'success');
 */
export function showToast(text: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
  document.dispatchEvent(new CustomEvent('ff-toast', {
    detail: { text, type }
  }));
}
