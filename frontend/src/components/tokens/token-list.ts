import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTokens, getDemoAgents } from '../../demo-mode';

@customElement('ff-token-list')
export class TokenList extends LitElement {
  @state() private tokens = [];
  @state() private isLoading = true;
  @state() private error = null;
  @state() private searchQuery = '';
  @state() private statusFilter = 'all';
  @state() private agentFilter = 'all';
  @state() private filteredTokens = [];
  @state() private isTokenModalOpen = false;
  @state() private generatedToken = null;
  @state() private newTokenName = '';
  @state() private newTokenExpiryDays = 365;
  @state() private selectedAgentId = '';
  @state() private newTokenType = 'access';

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
    this._loadTokens();
  }

  async _loadTokens() {
    this.isLoading = true;
    if (isDemoMode()) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      this.tokens = getDemoTokens();
      this._applyFilters();
    } else {
      this.error = 'API noch nicht implementiert';
    }
    this.isLoading = false;
  }
  
  _applyFilters() {
    // Filter-Logik hier implementieren
    this.filteredTokens = this.tokens;
  }

  render() {
    if (this.isLoading) {
      return html`<div class="loading">Tokens werden geladen...</div>`;
    }
    
    if (this.error) {
      return html`<div class="error">${this.error}</div>`;
    }
    
    return html`
      <div>
        <h2>Token-Verwaltung</h2>
        <button @click=${this._openTokenModal}>Neues Token erstellen</button>
        
        <div>
          ${this.filteredTokens.length === 0 ? 
            html`<p>Keine Tokens gefunden</p>` : 
            html`<table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Agent</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredTokens.map(token => html`
                  <tr>
                    <td>${token.name}</td>
                    <td>${this._getAgentName(token.agentId)}</td>
                    <td>${token.status}</td>
                    <td>
                      <button @click=${() => this._renewToken(token.id)}>Erneuern</button>
                      <button @click=${() => this._revokeToken(token.id)}>Widerrufen</button>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>`
          }
        </div>
        
        ${this.isTokenModalOpen ? html`
          <div class="modal-overlay" @click=${this._closeModalOnOverlayClick}>
            <div class="modal-content">
              <h3>Neues Token erstellen</h3>
              ${this.generatedToken ? 
                html`
                  <div>
                    <p>Token erfolgreich erstellt:</p>
                    <pre>${this.generatedToken}</pre>
                    <button @click=${this._copyTokenToClipboard}>Kopieren</button>
                    <p>Bewahren Sie dieses Token sicher auf, es wird nur einmal angezeigt!</p>
                  </div>
                ` : 
                html`
                  <form @submit=${this._createToken}>
                    <input placeholder="Token Name" .value=${this.newTokenName} 
                      @input=${e => this.newTokenName = e.target.value} required>
                    <select .value=${this.selectedAgentId} 
                      @change=${e => this.selectedAgentId = e.target.value} required>
                      <option value="">Agent auswählen</option>
                      ${this._getAgents().map(agent => html`
                        <option value=${agent.id}>${agent.name}</option>
                      `)}
                    </select>
                    <button type="submit">Token erstellen</button>
                  </form>
                `
              }
              <button @click=${this._closeTokenModal}>Schließen</button>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
  
  _getAgentName(agentId) {
    const agent = this._getAgents().find(a => a.id === agentId);
    return agent ? agent.name : 'Unbekannter Agent';
  }
  
  _getAgents() {
    return isDemoMode() ? getDemoAgents() : [];
  }
  
  _openTokenModal() {
    this.isTokenModalOpen = true;
  }

  _closeModalOnOverlayClick(e) {
    if (e.target.classList.contains('modal-overlay')) {
      this._closeTokenModal();
    }
  }

  _closeTokenModal() {
    this.isTokenModalOpen = false;
    this.generatedToken = null;
    this.newTokenName = '';
    this.newTokenExpiryDays = 365;
    // Das gewählte Agent und Type behalten wir bei, falls der Benutzer ein weiteres Token erstellen möchte
  }

  async _createToken(e) {
    e.preventDefault();
    
    if (!this.selectedAgentId) {
      alert('Bitte wählen Sie einen Agenten aus.');
      return;
    }
    
    try {
      // Demo-Implementierung
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Generiere ein zufälliges Token
      const randomToken = 'ff_' + this._generateRandomString(64);
      this.generatedToken = randomToken;
      
      // Füge das neue Token zur Liste hinzu
      const agentName = this._getAgentName(this.selectedAgentId);
      const now = new Date();
      const expiryDate = new Date();
      expiryDate.setDate(now.getDate() + this.newTokenExpiryDays);
      
      const newToken = {
        id: 'token-' + Date.now(),
        name: this.newTokenName,
        agentId: this.selectedAgentId,
        type: this.newTokenType,
        created: now.toISOString(),
        lastUsed: now.toISOString(),
        expiresAt: expiryDate.toISOString(),
        status: 'active'
      };
      
      this.tokens = [newToken, ...this.tokens];
      this._applyFilters();
    } catch (err) {
      alert('Fehler beim Erstellen des Tokens: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error creating token:', err);
    }
  }

  _generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    const randomValues = new Uint8Array(length);
    window.crypto.getRandomValues(randomValues);
    
    for (let i = 0; i < length; i++) {
      result += chars.charAt(randomValues[i] % chars.length);
    }
    
    return result;
  }

  async _copyTokenToClipboard() {
    if (!this.generatedToken) return;
    
    try {
      await navigator.clipboard.writeText(this.generatedToken);
      alert('Token in die Zwischenablage kopiert!');
    } catch (err) {
      console.error('Failed to copy token:', err);
      
      // Fallback für Browser, die die Clipboard API nicht unterstützen
      const textArea = document.createElement('textarea');
      textArea.value = this.generatedToken;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        alert('Token in die Zwischenablage kopiert!');
      } catch (e) {
        console.error('Failed to copy using execCommand:', e);
        alert('Konnte nicht in die Zwischenablage kopieren. Bitte kopieren Sie das Token manuell.');
      }
      
      document.body.removeChild(textArea);
    }
  }

  async _renewToken(tokenId) {
    if (!confirm('Möchten Sie dieses Token wirklich erneuern? Das bestehende Token bleibt gültig, wird aber durch ein neues Token mit verlängerter Gültigkeit ergänzt.')) {
      return;
    }
    
    try {
      // Demo-Implementierung
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Finde das Token, das erneuert werden soll
      const tokenIndex = this.tokens.findIndex(t => t.id === tokenId);
      if (tokenIndex === -1) {
        throw new Error('Token nicht gefunden');
      }
      
      const token = this.tokens[tokenIndex];
      
      // Berechne neues Ablaufdatum (ein Jahr ab heute)
      const expiryDate = new Date();
      expiryDate.setFullYear(expiryDate.getFullYear() + 1);
      
      // Aktualisiere das Token
      this.tokens = [
        ...this.tokens.slice(0, tokenIndex),
        {
          ...token,
          expiresAt: expiryDate.toISOString(),
          status: 'active'
        },
        ...this.tokens.slice(tokenIndex + 1)
      ];
      
      this._applyFilters();
      
      alert('Token erfolgreich erneuert!');
    } catch (err) {
      alert('Fehler beim Erneuern des Tokens: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error renewing token:', err);
    }
  }

  async _revokeToken(tokenId) {
    if (!confirm('Sind Sie sicher, dass Sie dieses Token widerrufen möchten? Diese Aktion kann nicht rückgängig gemacht werden und das Token wird sofort ungültig.')) {
      return;
    }
    
    try {
      // Demo-Implementierung
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Entferne das Token aus der Liste
      this.tokens = this.tokens.filter(token => token.id !== tokenId);
      this._applyFilters();
      
      alert('Token erfolgreich widerrufen!');
    } catch (err) {
      alert('Fehler beim Widerrufen des Tokens: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error revoking token:', err);
    }
  }
}

// Optional: Prüfung außerhalb der Klasse, falls wirklich nötig
if (!customElements.get('ff-token-list')) {
  customElements.define('ff-token-list', TokenList);
} 