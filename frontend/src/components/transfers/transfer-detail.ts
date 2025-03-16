import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers } from '../../demo-mode';

if (!customElements.get('ff-transfer-detail')) {
  @customElement('ff-transfer-detail')
  export class TransferDetail extends LitElement {
    @property({ type: String }) transferId = '';
    @state() private isLoading = true;
    @state() private transfer = null;

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
      return html`<h2>Transfer-Details für ID: ${this.transferId}</h2>`;
    }
  }
} 