import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoAgents } from '../../demo-mode';

@customElement('ff-agent-list')
export class AgentList extends LitElement {
  @state() private agents = [];
  @state() private filteredAgents = [];
  @state() private isLoading = true;
  @state() private error = null;
  @state() private searchQuery = '';
  @state() private statusFilter = 'all';
  @state() private typeFilter = 'all';
  @state() private sortField = 'lastSeen';
  @state() private sortDirection = 'desc';

  static styles = css`
    :host {
      display: block;
    }
    
    .agent-list-container {
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
    
    .agents-container {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    
    .agent-card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      padding: 20px;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }
    
    .agent-card:hover {
      transform: translateY(-3px);
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    }
    
    .agent-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    
    .agent-name {
      font-size: 18px;
      font-weight: 500;
      margin: 0 0 4px 0;
      color: #122e53;
    }
    
    .agent-type {
      font-size: 14px;
      color: #6c757d;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 500;
    }
    
    .status-online {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .status-offline {
      background-color: rgba(108, 117, 125, 0.1);
      color: #6c757d;
    }
    
    .status-error {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    
    .agent-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 16px;
    }
    
    .info-label {
      font-size: 12px;
      color: #6c757d;
    }
    
    .info-value {
      font-size: 14px;
      color: #212529;
    }
    
    .agent-description {
      font-size: 14px;
      color: #495057;
      margin-top: auto;
      border-top: 1px solid #f0f0f0;
      padding-top: 12px;
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
      text-align: center;
      padding: 48px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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
    
    .install-code {
      background-color: #272822;
      color: #f8f8f2;
      padding: 16px;
      border-radius: 4px;
      font-family: monospace;
      overflow-x: auto;
      margin-top: 16px;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadAgents();
  }

  async _loadAgents() {
    try {
      this.isLoading = true;
      this.error = null;
      
      if (isDemoMode()) {
        // Simuliere Netzwerklatenz für realistischeres Verhalten
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const agents = getDemoAgents();
        this.agents = agents;
        
        // Anwenden der Filter beim ersten Laden
        this._applyFilters();
      } else {
        // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
        this.error = 'API noch nicht implementiert. Bitte aktiviere den Demo-Modus.';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden der Agents: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading agents:', err);
    } finally {
      this.isLoading = false;
    }
  }

  _applyFilters() {
    let filtered = [...this.agents];
    
    // Textsuche
    if (this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      filtered = filtered.filter(agent => 
        agent.name.toLowerCase().includes(query) || 
        (agent.description && agent.description.toLowerCase().includes(query)) ||
        (agent.ipAddress && agent.ipAddress.toLowerCase().includes(query)) ||
        (agent.system && agent.system.toLowerCase().includes(query))
      );
    }
    
    // Status-Filter
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(agent => agent.status === this.statusFilter);
    }
    
    // Typ-Filter
    if (this.typeFilter !== 'all') {
      filtered = filtered.filter(agent => agent.type === this.typeFilter);
    }
    
    // Sortierung
    filtered.sort((a, b) => {
      let valueA, valueB;
      
      // Spezielle Behandlung je nach Sortierfeld
      switch (this.sortField) {
        case 'name':
          valueA = a.name.toLowerCase();
          valueB = b.name.toLowerCase();
          break;
        case 'lastSeen':
          valueA = new Date(a.lastSeen).getTime();
          valueB = new Date(b.lastSeen).getTime();
          break;
        case 'status':
          valueA = a.status;
          valueB = b.status;
          break;
        default:
          valueA = a[this.sortField];
          valueB = b[this.sortField];
      }
      
      // Aufsteigende oder absteigende Sortierung
      const sortMultiplier = this.sortDirection === 'asc' ? 1 : -1;
      
      if (valueA < valueB) return -1 * sortMultiplier;
      if (valueA > valueB) return 1 * sortMultiplier;
      return 0;
    });
    
    this.filteredAgents = filtered;
  }

  _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffMins < 1) {
      return 'gerade eben';
    } else if (diffMins < 60) {
      return `vor ${diffMins} ${diffMins === 1 ? 'Minute' : 'Minuten'}`;
    } else if (diffHours < 24) {
      return `vor ${diffHours} ${diffHours === 1 ? 'Stunde' : 'Stunden'}`;
    } else if (diffDays < 7) {
      return `vor ${diffDays} ${diffDays === 1 ? 'Tag' : 'Tagen'}`;
    } else {
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });
    }
  }

  _formatStatus(status) {
    switch (status) {
      case 'online': return 'Online';
      case 'offline': return 'Offline';
      case 'error': return 'Fehler';
      default: return status;
    }
  }

  _formatAgentType(type) {
    switch (type) {
      case 'server': return 'Server';
      case 'client': return 'Client';
      default: return type;
    }
  }

  _getStatusClass(status) {
    switch (status) {
      case 'online': return 'status-online';
      case 'offline': return 'status-offline';
      case 'error': return 'status-error';
      default: return '';
    }
  }

  _handleSearchInput(e) {
    this.searchQuery = e.target.value;
    this._applyFilters();
  }

  _handleStatusFilterChange(e) {
    this.statusFilter = e.target.value;
    this._applyFilters();
  }

  _handleTypeFilterChange(e) {
    this.typeFilter = e.target.value;
    this._applyFilters();
  }

  _navigateToAgent(agentId) {
    window.location.href = `/agents/${agentId}`;
  }

  _showAgentInstallModal() {
    alert('In einer vollständigen Implementierung würde hier ein Modal mit Installationsanweisungen erscheinen.');
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
        <div class="agent-list-container">
          <div class="error-message">
            <div>${this.error}</div>
            <button @click=${this._loadAgents}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="agent-list-container">
        <div class="header">
          <h1 class="title">Agents</h1>
          <button class="action-button primary-button" @click=${this._showAgentInstallModal}>
            + Neuen Agent installieren
          </button>
        </div>
        
        <div class="filters">
          <input
            class="search-input"
            type="text"
            placeholder="Agent suchen..."
            .value=${this.searchQuery}
            @input=${this._handleSearchInput}
          />
          
          <select
            class="filter-select"
            .value=${this.statusFilter}
            @change=${this._handleStatusFilterChange}
          >
            <option value="all">Alle Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="error">Fehler</option>
          </select>
          
          <select
            class="filter-select"
            .value=${this.typeFilter}
            @change=${this._handleTypeFilterChange}
          >
            <option value="all">Alle Typen</option>
            <option value="server">Server</option>
            <option value="client">Client</option>
          </select>
        </div>
        
        ${this.filteredAgents.length === 0 ? html`
          <div class="empty-message">
            <p>Keine Agents gefunden. Installieren Sie einen neuen Agent, um zu beginnen.</p>
            <button class="action-button primary-button" @click=${this._showAgentInstallModal}>
              Agent installieren
            </button>
            
            <div class="install-code">
              <code>curl -sSL https://get.fileflux.io | bash</code>
            </div>
          </div>
        ` : html`
          <div class="agents-container">
            ${this.filteredAgents.map(agent => html`
              <div class="agent-card" @click=${() => this._navigateToAgent(agent.id)}>
                <div class="agent-header">
                  <div>
                    <h3 class="agent-name">${agent.name}</h3>
                    <div class="agent-type">${this._formatAgentType(agent.type)}</div>
                  </div>
                  <span class="status-badge ${this._getStatusClass(agent.status)}">
                    ${this._formatStatus(agent.status)}
                  </span>
                </div>
                
                <div class="agent-info">
                  <div>
                    <div class="info-label">IP-Adresse</div>
                    <div class="info-value">${agent.ipAddress || 'N/A'}</div>
                  </div>
                  
                  <div>
                    <div class="info-label">Version</div>
                    <div class="info-value">${agent.version}</div>
                  </div>
                  
                  <div>
                    <div class="info-label">System</div>
                    <div class="info-value">${agent.system || 'Unbekannt'}</div>
                  </div>
                  
                  <div>
                    <div class="info-label">Zuletzt gesehen</div>
                    <div class="info-value">${this._formatDateTime(agent.lastSeen)}</div>
                  </div>
                </div>
                
                ${agent.description ? html`
                  <div class="agent-description">
                    ${agent.description}
                  </div>
                ` : ''}
              </div>
            `)}
          </div>
        `}
      </div>
    `;
  }
} 