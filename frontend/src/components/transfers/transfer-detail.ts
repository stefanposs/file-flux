import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers } from '../../demo-mode';

@customElement('ff-transfer-detail')
export class TransferDetail extends LitElement {
  @property({ type: String }) transferId = '';
  @state() private isLoading = true;
  @state() private transfer = null;
  @state() private error = null;

  static styles = css`
    :host {
      display: block;
    }
    
    .loading {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 200px;
      font-size: 18px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadTransfer();
  }

  async _loadTransfer() {
    this.isLoading = true;
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const transfers = getDemoTransfers();
      this.transfer = transfers.find(t => t.id === this.transferId);
    }
    this.isLoading = false;
  }

  render() {
    if (this.isLoading) {
      return html`<div class="loading">Transfer-Details werden geladen...</div>`;
    }
    
    if (!this.transfer) {
      return html`<div>Transfer nicht gefunden</div>`;
    }
    
    return html`
      <h2>Transfer-Details</h2>
      
      <div>
        <h3>${this.transfer.filename}</h3>
        <p>Status: ${this.transfer.status}</p>
        <p>Größe: ${this.transfer.size} Bytes</p>
        <p>Startzeit: ${new Date(this.transfer.startTime).toLocaleString()}</p>
        ${this.transfer.endTime ? html`<p>Endzeit: ${new Date(this.transfer.endTime).toLocaleString()}</p>` : ''}
      </div>
    `;
  }
} 