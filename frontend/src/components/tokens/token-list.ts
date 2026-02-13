import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTokens, getDemoAgents, createDemoToken, deleteDemoToken } from '../../demo-mode';

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
  @state() private newTokenDescription = '';

  static styles = css`
    :host {
      display: block;
    }
    
    .token-list-container {
      padding: 24px;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    .title {
      font-size: 24px;
      color: #122e53;
      margin: 0;
    }
    
    .action-button {
      padding: 10px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .primary-button {
      background-color: #122e53;
      color: white;
      border: none;
    }
    
    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .search-input {
      flex: 1;
      min-width: 200px;
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .filter-select {
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 14px;
      background-color: white;
    }
    
    .tokens-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      overflow: hidden;
    }
    
    .tokens-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .tokens-table th,
    .tokens-table td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .tokens-table th {
      background-color: #f8f9fa;
      color: #6c757d;
      font-weight: 500;
    }
    
    .tokens-table tr:last-child td {
      border-bottom: none;
    }
    
    .tokens-table tr:hover {
      background-color: #f8f9fa;
    }
    
    .token-actions {
      display: flex;
      gap: 8px;
    }
    
    .token-action {
      background: none;
      border: none;
      color: #122e53;
      cursor: pointer;
      padding: 4px 8px;
      font-size: 13px;
      border-radius: 4px;
    }
    
    .token-action:hover {
      background-color: rgba(18, 46, 83, 0.1);
    }
    
    .token-action.danger {
      color: #dc3545;
    }
    
    .token-action.danger:hover {
      background-color: rgba(220, 53, 69, 0.1);
    }
    
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
    }
    
    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(18, 46, 83, 0.1);
      border-left-color: #122e53;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    
    .empty-message {
      padding: 48px;
      text-align: center;
      color: #6c757d;
    }
    
    .error-message {
      padding: 16px;
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
      border-radius: 4px;
      margin-bottom: 20px;
      text-align: center;
    }
    
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .status-active {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .status-expired {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    
    .status-expiring {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background-color: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    
    .modal-content {
      background-color: white;
      border-radius: 8px;
      padding: 24px;
      width: 500px;
      max-width: 90%;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
    }
    
    .modal-title {
      font-size: 20px;
      margin-top: 0;
      margin-bottom: 24px;
      color: #122e53;
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
    .form-label {
      display: block;
      margin-bottom: 8px;
      font-weight: 500;
    }
    
    .form-input,
    .form-select,
    .form-textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .form-textarea {
      resize: vertical;
      min-height: 80px;
    }
    
    .token-display {
      background-color: #f8f9fa;
      padding: 16px;
      border-radius: 4px;
      overflow-x: auto;
      margin-bottom: 16px;
      position: relative;
    }
    
    .token-string {
      font-family: monospace;
      word-break: break-all;
    }
    
    .token-warning {
      color: #dc3545;
      font-size: 14px;
      margin-top: 8px;
    }
    
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 24px;
    }
    
    .copy-button {
      position: absolute;
      top: 8px;
      right: 8px;
      background-color: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 4px 8px;
      font-size: 12px;
      cursor: pointer;
    }
    
    .copy-button:hover {
      background-color: #f0f0f0;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadTokens();
  }

  async _loadTokens() {
    try {
      this.isLoading = true;
      this.error = null;
      
      if (isDemoMode()) {
        // Simuliere Netzwerklatenz für realistischeres Verhalten
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const tokens = getDemoTokens();
        this.tokens = tokens;
        
        // Anwenden der Filter beim ersten Laden
        this._applyFilters();
      } else {
        // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
        this.error = 'API noch nicht implementiert. Bitte aktiviere den Demo-Modus.';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden der Tokens: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading tokens:', err);
    } finally {
      this.isLoading = false;
    }
  }

  _applyFilters() {
    let filtered = [...this.tokens];
    
    // Textsuche
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(token => 
        token.name.toLowerCase().includes(query) || 
        (token.description && token.description.toLowerCase().includes(query))
      );
    }
    
    // Status-Filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(token => token.status === this.statusFilter);
    }
    
    // Agent-Filter
    if (this.agentFilter !== 'all') {
      filtered = filtered.filter(token => token.agentId === this.agentFilter);
    }
    
    this.filteredTokens = filtered;
  }

  _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  _formatStatus(status) {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'expired': return 'Abgelaufen';
      case 'expiring_soon': return 'Läuft bald ab';
      default: return status;
    }
  }

  _getStatusClass(status) {
    switch (status) {
      case 'active': return 'status-active';
      case 'expired': return 'status-expired';
      case 'expiring_soon': return 'status-expiring';
      default: return '';
    }
  }

  _getAgentName(agentId) {
    if (!agentId) return '-';
    
    const agent = this._getAgents().find(a => a.id === agentId);
    return agent ? agent.name : `Agent (${agentId})`;
  }

  _getAgents() {
    return isDemoMode() ? getDemoAgents() : [];
  }

  _handleSearchInput(e) {
    this.searchQuery = e.target.value;
    this._applyFilters();
  }

  _handleStatusFilterChange(e) {
    this.statusFilter = e.target.value;
    this._applyFilters();
  }

  _handleAgentFilterChange(e) {
    this.agentFilter = e.target.value;
    this._applyFilters();
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
    this.selectedAgentId = '';
    this.newTokenDescription = '';
  }

  async _createToken(e) {
    e.preventDefault();
    
    if (!this.newTokenName.trim()) {
      alert('Bitte geben Sie einen Namen für das Token ein.');
      return;
    }
    
    try {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Generiere ein zufälliges Token für die Demo
        const randomToken = 'fft_' + this._generateRandomString(32);
        this.generatedToken = randomToken;
        
        // Expirationsdatum berechnen
        const now = new Date();
        const expiresAt = new Date(now);
        expiresAt.setDate(expiresAt.getDate() + this.newTokenExpiryDays);
        
        // Token erstellen
        const newToken = {
          name: this.newTokenName,
          agentId: this.selectedAgentId || null,
          description: this.newTokenDescription,
          expiresAt: expiresAt.toISOString()
        };
        
        const createdToken = createDemoToken(newToken);
        
        // Token zur Liste hinzufügen und Filter anwenden
        this.tokens = [createdToken, ...this.tokens];
        this._applyFilters();
      } else {
        this.error = 'API noch nicht implementiert. Bitte aktiviere den Demo-Modus.';
      }
    } catch (err) {
      alert('Fehler beim Erstellen des Tokens: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error creating token:', err);
    }
  }

  _generateRandomString(length) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < length; i++) {
      const randomIndex = Math.floor(Math.random() * chars.length);
      result += chars.charAt(randomIndex);
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
        const successful = document.execCommand('copy');
        if (successful) {
          alert('Token in die Zwischenablage kopiert!');
        } else {
          alert('Konnte nicht in die Zwischenablage kopieren. Bitte kopieren Sie das Token manuell.');
        }
      } catch (e) {
        console.error('Failed to copy using execCommand:', e);
        alert('Konnte nicht in die Zwischenablage kopieren. Bitte kopieren Sie das Token manuell.');
      }
      
      document.body.removeChild(textArea);
    }
  }

  async _revokeToken(tokenId) {
    if (!confirm('Sind Sie sicher, dass Sie dieses Token widerrufen möchten? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return;
    }
    
    try {
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        deleteDemoToken(tokenId);
        
        // Token aus der lokalen Liste entfernen
        this.tokens = this.tokens.filter(token => token.id !== tokenId);
        this._applyFilters();
        
        alert('Token erfolgreich widerrufen.');
      } else {
        this.error = 'API noch nicht implementiert. Bitte aktiviere den Demo-Modus.';
      }
    } catch (err) {
      alert('Fehler beim Widerrufen des Tokens: ' + (err instanceof Error ? err.message : String(err)));
      console.error('Error revoking token:', err);
    }
  }

  render() {
    if (this.isLoading) {
      return html`
        <div class="loading-container">
          <div class="loading-spinner"></div>
        </div>
      `;
    }

    if (this.error) {
      return html`
        <div class="token-list-container">
          <div class="error-message">
            <div>${this.error}</div>
            <button @click=${this._loadTokens}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    const agents = this._getAgents();

    return html`
      <div class="token-list-container">
        <div class="header">
          <h1 class="title">API-Tokens</h1>
          <button class="action-button primary-button" @click=${this._openTokenModal}>
            + Neues Token erstellen
          </button>
        </div>
        
        <div class="filters">
          <input
            class="search-input"
            type="text"
            placeholder="Token suchen..."
            .value=${this.searchQuery}
            @input=${this._handleSearchInput}
          />
          
          <select
            class="filter-select"
            .value=${this.statusFilter}
            @change=${this._handleStatusFilterChange}
          >
            <option value="all">Alle Status</option>
            <option value="active">Aktiv</option>
            <option value="expiring_soon">Läuft bald ab</option>
            <option value="expired">Abgelaufen</option>
          </select>
          
          <select
            class="filter-select"
            .value=${this.agentFilter}
            @change=${this._handleAgentFilterChange}
          >
            <option value="all">Alle Agenten</option>
            ${agents.map(agent => html`
              <option value=${agent.id}>${agent.name}</option>
            `)}
          </select>
        </div>
        
        <div class="tokens-container">
          ${this.filteredTokens.length === 0 ? html`
            <div class="empty-message">
              Keine Tokens gefunden. Erstellen Sie ein neues Token, um zu beginnen.
            </div>
          ` : html`
            <table class="tokens-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Agent</th>
                  <th>Erstellt am</th>
                  <th>Läuft ab am</th>
                  <th>Zuletzt verwendet</th>
                  <th>Status</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredTokens.map(token => html`
                  <tr>
                    <td>${token.name}</td>
                    <td>${this._getAgentName(token.agentId)}</td>
                    <td>${this._formatDateTime(token.created)}</td>
                    <td>${token.expiresAt ? this._formatDateTime(token.expiresAt) : 'Nie'}</td>
                    <td>${token.lastUsed ? this._formatDateTime(token.lastUsed) : 'Nie'}</td>
                    <td>
                      <span class="status-badge ${this._getStatusClass(token.status)}">
                        ${this._formatStatus(token.status)}
                      </span>
                    </td>
                    <td>
                      <div class="token-actions">
                        <button
                          class="token-action danger"
                          @click=${() => this._revokeToken(token.id)}
                          title="Token widerrufen"
                        >
                          Widerrufen
                        </button>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          `}
        </div>
        
        ${this.isTokenModalOpen ? html`
          <div class="modal-overlay" @click=${this._closeModalOnOverlayClick}>
            <div class="modal-content" @click=${e => e.stopPropagation()}>
              <h2 class="modal-title">
                ${this.generatedToken ? 'Token erstellt' : 'Neues Token erstellen'}
              </h2>
              
              ${this.generatedToken ? html`
                <div>
                  <p>Ihr Token wurde erfolgreich erstellt. Bitte kopieren Sie es jetzt, da es später nicht mehr angezeigt werden kann:</p>
                  
                  <div class="token-display">
                    <pre class="token-string">${this.generatedToken}</pre>
                    <button class="copy-button" @click=${this._copyTokenToClipboard}>
                      Kopieren
                    </button>
                  </div>
                  
                  <p class="token-warning">
                    <strong>Wichtig:</strong> Bewahren Sie dieses Token sicher auf. Es wird aus Sicherheitsgründen nur einmal angezeigt und kann nicht wiederhergestellt werden.
                  </p>
                </div>
              ` : html`
                <form @submit=${this._createToken}>
                  <div class="form-group">
                    <label class="form-label" for="token-name">Token-Name *</label>
                    <input
                      class="form-input"
                      id="token-name"
                      type="text"
                      .value=${this.newTokenName}
                      @input=${e => this.newTokenName = e.target.value}
                      placeholder="z.B. Produktionsserver-Token"
                      required
                    />
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label" for="token-agent">Agent (optional)</label>
                    <select
                      class="form-select"
                      id="token-agent"
                      .value=${this.selectedAgentId}
                      @change=${e => this.selectedAgentId = e.target.value}
                    >
                      <option value="">-- Keinen Agent zuweisen --</option>
                      ${agents.map(agent => html`
                        <option value=${agent.id}>${agent.name}</option>
                      `)}
                    </select>
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label" for="token-expiry">Gültigkeitsdauer (in Tagen)</label>
                    <input
                      class="form-input"
                      id="token-expiry"
                      type="number"
                      min="1"
                      max="3650"
                      .value=${this.newTokenExpiryDays}
                      @input=${e => this.newTokenExpiryDays = parseInt(e.target.value, 10)}
                    />
                  </div>
                  
                  <div class="form-group">
                    <label class="form-label" for="token-description">Beschreibung (optional)</label>
                    <textarea
                      class="form-textarea"
                      id="token-description"
                      .value=${this.newTokenDescription}
                      @input=${e => this.newTokenDescription = e.target.value}
                      placeholder="Wozu wird dieses Token verwendet?"
                    ></textarea>
                  </div>
                  
                  <div class="modal-actions">
                    <button
                      type="button"
                      class="action-button secondary-button"
                      @click=${this._closeTokenModal}
                    >
                      Abbrechen
                    </button>
                    <button
                      type="submit"
                      class="action-button primary-button"
                    >
                      Token erstellen
                    </button>
                  </div>
                </form>
              `}
              
              ${this.generatedToken ? html`
                <div class="modal-actions">
                  <button
                    class="action-button primary-button"
                    @click=${this._closeTokenModal}
                  >
                    Schließen
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }
}
