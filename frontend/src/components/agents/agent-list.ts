import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoAgents } from '../../demo-mode';
import { showToast } from '../shared/toast';
import { api } from '../../services/api-service';
import './agent-onboarding';

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
  @state() private isInstallModalOpen = false;
  @state() private isOnboardingOpen = false;

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
      color: var(--ff-gray-900, #111827);
      margin: 0;
      font-weight: 700;
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
      background-color: var(--ff-primary, #4f46e5);
      color: white;
      border: none;
      transition: background 0.2s;
    }

    .primary-button:hover {
      background-color: var(--ff-primary-hover, #4338ca);
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
      border: 1px solid var(--ff-border);
      border-radius: 4px;
      font-size: 14px;
    }
    
    .filter-select {
      padding: 8px 12px;
      border: 1px solid var(--ff-border);
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
      border-radius: var(--ff-radius-md, 8px);
      box-shadow: var(--ff-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      border: 1px solid var(--ff-gray-200, #e5e7eb);
      padding: 20px;
      display: flex;
      flex-direction: column;
      transition: transform 0.2s, box-shadow 0.2s;
      cursor: pointer;
    }
    
    .agent-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--ff-shadow-md, 0 4px 6px rgba(0,0,0,0.1));
    }
    
    .agent-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
    }
    
    .agent-name {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 4px 0;
      color: var(--ff-gray-900, #111827);
    }
    
    .agent-type {
      font-size: 14px;
      color: var(--ff-gray-500);
    }
    
    .agent-info {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 16px;
    }
    
    .info-label {
      font-size: 12px;
      color: var(--ff-gray-500);
    }
    
    .info-value {
      font-size: 14px;
      color: var(--ff-gray-900);
    }
    
    .agent-description {
      font-size: 14px;
      color: var(--ff-gray-600);
      margin-top: auto;
      border-top: 1px solid var(--ff-gray-100);
      padding-top: 12px;
    }
    

    
    .error-message {
      padding: 16px;
      background-color: var(--ff-error-light);
      color: var(--ff-error);
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

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background: var(--ff-surface);
      border-radius: 8px;
      width: 100%;
      max-width: 560px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid var(--ff-border);
    }
    .modal-header h2 { margin: 0; font-size: 18px; color: var(--ff-gray-900, #111827); }
    .modal-close {
      background: none; border: none; font-size: 24px; cursor: pointer; color: var(--ff-gray-500);
    }
    .modal-body {
      padding: 20px;
    }
    .modal-body p {
      margin: 0 0 12px 0; color: var(--ff-gray-600); font-size: 14px; line-height: 1.5;
    }
    .modal-body h3 {
      margin: 20px 0 8px 0; font-size: 15px; color: var(--ff-primary, #4f46e5);
    }
    .modal-body h3:first-child { margin-top: 0; }
    .code-block {
      background-color: #272822;
      color: #f8f8f2;
      padding: 14px 16px;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
      overflow-x: auto;
      margin-bottom: 12px;
      position: relative;
      line-height: 1.5;
      white-space: pre;
    }
    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: rgba(255,255,255,0.15);
      border: none;
      color: #f8f8f2;
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    .copy-btn:hover {
      background: rgba(255,255,255,0.25);
    }
    .config-block {
      background-color: var(--ff-gray-50);
      padding: 14px 16px;
      border-radius: 6px;
      font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
      font-size: 13px;
      overflow-x: auto;
      margin-bottom: 12px;
      line-height: 1.5;
      white-space: pre;
      border: 1px solid var(--ff-border);
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      padding: 12px 20px;
      border-top: 1px solid var(--ff-border);
    }
    .btn-close-modal {
      padding: 8px 20px;
      border: 1px solid var(--ff-border);
      background: var(--ff-surface);
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
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
      
      // Try real API first
      if (api.isAuthenticated()) {
        try {
          const apiAgents = await api.getAgents();
          this.agents = apiAgents.map(a => ({
            id: String(a.id),
            name: a.name,
            type: a.type,
            status: a.status,
            ipAddress: a.ip_address || '',
            system: a.system || '',
            version: a.version || '',
            lastSeen: a.last_seen,
            description: a.description,
          }));
          this._applyFilters();
          return;
        } catch (apiErr) {
          console.warn('API load failed, falling back to demo', apiErr);
        }
      }

      if (isDemoMode()) {
        // Simuliere Netzwerklatenz für realistischeres Verhalten
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const agents = getDemoAgents();
        this.agents = agents;
        
        // Anwenden der Filter beim ersten Laden
        this._applyFilters();
      } else {
        // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
        this.error = 'Bitte melden Sie sich an.';
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

  _formatAgentType(type) {
    switch (type) {
      case 'server': return 'Server';
      case 'client': return 'Client';
      default: return type;
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
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/agents/${agentId}` },
      bubbles: true,
      composed: true
    }));
  }

  _showAgentInstallModal() {
    this.isInstallModalOpen = true;
  }

  _closeInstallModal() {
    this.isInstallModalOpen = false;
  }

  _closeInstallModalOnOverlay(e: Event) {
    if ((e.target as HTMLElement).classList.contains('modal-overlay')) {
      this._closeInstallModal();
    }
  }

  async _copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('In die Zwischenablage kopiert', 'success');
    } catch {
      showToast('Kopieren fehlgeschlagen', 'error');
    }
  }

  _renderInstallModal() {
    if (!this.isInstallModalOpen) return '';

    const installScript = 'curl -sSL https://get.fileflux.io | bash';
    const configYaml = `server:
  url: "https://your-server.fileflux.io"
  port: 3001

agent:
  name: "mein-agent"
  type: "client"
  token: "<IHR_AGENT_TOKEN>"

paths:
  upload: "/data/uploads"
  download: "/data/downloads"`;

    return html`
      <div class="modal-overlay" @click=${this._closeInstallModalOnOverlay}>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Agent installieren</h2>
            <button class="modal-close" @click=${this._closeInstallModal}>&times;</button>
          </div>
          <div class="modal-body">
            <h3>1. Installation (Linux/macOS)</h3>
            <p>Führen Sie folgenden Befehl auf dem Zielsystem aus:</p>
            <div class="code-block">
              ${installScript}
              <button class="copy-btn" @click=${() => this._copyToClipboard(installScript)}>Kopieren</button>
            </div>

            <h3>2. Konfiguration</h3>
            <p>Passen Sie die Datei <code>/etc/fileflux/config.yaml</code> an:</p>
            <div class="config-block">${configYaml}</div>

            <h3>3. Agent starten</h3>
            <div class="code-block">
              sudo systemctl enable --now fileflux-agent
              <button class="copy-btn" @click=${() => this._copyToClipboard('sudo systemctl enable --now fileflux-agent')}>Kopieren</button>
            </div>

            <p>Erstellen Sie vorher ein Agent-Token unter <strong>Tokens</strong>, um den Agent zu authentifizieren.</p>
          </div>
          <div class="modal-footer">
            <button class="btn-close-modal" @click=${this._closeInstallModal}>Schließen</button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this.isLoading) {
      return html`<ff-loading-spinner></ff-loading-spinner>`;
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
          <button class="action-button primary-button" @click=${() => { this.isOnboardingOpen = true; }}>
            + Neuen Agent einrichten
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
          <ff-empty-state
            icon="🖥"
            title="Keine Agents gefunden"
            description="Richten Sie einen neuen Agent ein, um zu beginnen."
          ></ff-empty-state>
        ` : html`
          <div class="agents-container">
            ${this.filteredAgents.map(agent => html`
              <div class="agent-card" @click=${() => this._navigateToAgent(agent.id)}>
                <div class="agent-header">
                  <div>
                    <h3 class="agent-name">${agent.name}</h3>
                    <div class="agent-type">${this._formatAgentType(agent.type)}</div>
                  </div>
                  <ff-status-badge status="${agent.status}"></ff-status-badge>
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
      ${this._renderInstallModal()}
      ${this.isOnboardingOpen ? html`
        <ff-agent-onboarding @close=${() => { this.isOnboardingOpen = false; this._loadAgents(); }}></ff-agent-onboarding>
      ` : ''}
    `;
  }
} 