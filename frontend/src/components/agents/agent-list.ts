import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoAgents } from '../../demo-mode';

.action-button {
  background: none;
  border: none;
  width: 32px;
  height: 32px;
  display: flex;
  justify-content: center;
  align-items: center;
  border-radius: 4px;
  cursor: pointer;
  color: #666;
  transition: background-color 0.2s ease;
}

.action-button:hover {
  background-color: #f0f0f0;
}

.edit-button {
  color: #122e53;
}

.delete-button {
  color: #dc3545;
}

.token-button {
  color: #ffd202;
}

.loading-container, .error-container, .empty-container {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 48px;
  background-color: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
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

.error-message {
  color: #dc3545;
  text-align: center;
}

.empty-message {
  color: #666;
  text-align: center;
}

.last-seen {
  white-space: nowrap;
}

if (!customElements.get('ff-agent-list')) {
  @customElement('ff-agent-list')
  export class AgentList extends LitElement {
    @state() private agents = [];
    @state() private isLoading = true;
    @state() private error = null;
    @state() private searchQuery = '';
    @state() private statusFilter = 'all';
    @state() private typeFilter = 'all';
    @state() private filteredAgents = [];

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
      this._loadAgents();
    }

    async _loadAgents() {
      try {
        this.isLoading = true;
        
        if (isDemoMode()) {
          // Im Demo-Modus Daten aus den Demo-Daten laden
          await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
          this.agents = getDemoAgents();
        } else {
          // Hier würde später der API-Aufruf kommen
          // const agents = await agentService.getAgents();
          // this.agents = agents;
          this.error = 'API noch nicht implementiert';
        }
        
        this._applyFilters();
      } catch (err) {
        this.error = 'Fehler beim Laden der Agenten: ' + (err instanceof Error ? err.message : String(err));
        console.error('Error loading agents:', err);
      } finally {
        this.isLoading = false;
      }
    }

    _applyFilters() {
      if (!this.agents.length) {
        this.filteredAgents = [];
        return;
      }
      
      let result = [...this.agents];
      
      // Suchfilter anwenden
      if (this.searchQuery) {
        const query = this.searchQuery.toLowerCase();
        result = result.filter(agent => 
          agent.name.toLowerCase().includes(query) || 
          agent.system.toLowerCase().includes(query) ||
          agent.ipAddress.toLowerCase().includes(query)
        );
      }
      
      // Statusfilter anwenden
      if (this.statusFilter !== 'all') {
        result = result.filter(agent => agent.status === this.statusFilter);
      }
      
      // Typfilter anwenden
      if (this.typeFilter !== 'all') {
        result = result.filter(agent => agent.type === this.typeFilter);
      }
      
      this.filteredAgents = result;
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
          <div class="error-container">
            <div class="error-message">
              <div>🚫 ${this.error}</div>
              <button @click=${this._loadAgents}>Erneut versuchen</button>
            </div>
          </div>
        `;
      }

      return html`
        <div>
          <div class="header">
            <h1>Agenten</h1>
            <div>
              <button class="download-agent-button" @click=${this._downloadAgent}>
                <span>⬇️</span> Agent-Download
              </button>
              <button class="add-agent-button" @click=${this._navigateToCreateAgent}>
                <span>+</span> Neuen Agent registrieren
              </button>
            </div>
          </div>
          
          <div class="filters">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input 
                type="text" 
                class="search-input" 
                placeholder="Agenten durchsuchen..."
                .value=${this.searchQuery}
                @input=${this._handleSearchInput}
              >
            </div>
            
            <div class="filter-group">
              <span class="filter-label">Status:</span>
              <select class="filter-select" @change=${this._handleStatusFilterChange}>
                <option value="all">Alle</option>
                <option value="online">Online</option>
                <option value="offline">Offline</option>
              </select>
            </div>
            
            <div class="filter-group">
              <span class="filter-label">Typ:</span>
              <select class="filter-select" @change=${this._handleTypeFilterChange}>
                <option value="all">Alle</option>
                <option value="upload">Upload</option>
                <option value="download">Download</option>
              </select>
            </div>
          </div>
          
          ${this.filteredAgents.length === 0 ? html`
            <div class="empty-container">
              <div class="empty-message">
                <div>Keine Agenten gefunden.</div>
                ${this.searchQuery || this.statusFilter !== 'all' || this.typeFilter !== 'all' 
                  ? html`<div>Versuchen Sie, Ihre Filterkriterien anzupassen.</div>` 
                  : html`<div>Registrieren Sie einen neuen Agenten, um zu beginnen.</div>`
                }
              </div>
            </div>
          ` : html`
            <table class="agent-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Typ</th>
                  <th>System</th>
                  <th>IP-Adresse</th>
                  <th>Zuletzt gesehen</th>
                  <th>Aktionen</th>
                </tr>
              </thead>
              <tbody>
                ${this.filteredAgents.map(agent => html`
                  <tr>
                    <td>
                      <a href="/agents/${agent.id}" @click=${(e: Event) => this._navigateToAgentDetail(e, agent.id)}>
                        ${agent.name}
                      </a>
                    </td>
                    <td>
                      <span class="status-badge status-${agent.status}">
                        ${agent.status === 'online' ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td>
                      <span class="agent-type-badge type-${agent.type}">
                        ${agent.type === 'upload' ? 'Upload' : 'Download'}
                      </span>
                    </td>
                    <td>${agent.system}</td>
                    <td>${agent.ipAddress}</td>
                    <td class="last-seen">${this._formatDateTime(agent.lastSeen)}</td>
                    <td>
                      <div class="agent-actions">
                        <button class="action-button token-button" title="Token verwalten" @click=${(e: Event) => this._manageToken(e, agent.id)}>
                          🔑
                        </button>
                        <button class="action-button edit-button" title="Bearbeiten" @click=${(e: Event) => this._editAgent(e, agent.id)}>
                          ✏️
                        </button>
                        <button class="action-button delete-button" title="Löschen" @click=${(e: Event) => this._deleteAgent(e, agent.id)}>
                          🗑️
                        </button>
                      </div>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          `}
        </div>
      `;
    }

    _formatDateTime(dateStr: string): string {
      const date = new Date(dateStr);
      
      // Wenn das Datum von heute ist, nur die Uhrzeit anzeigen
      const today = new Date();
      if (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
      ) {
        return date.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        });
      }
      
      // Wenn das Datum vom Vortag ist, "Gestern" anzeigen
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      if (
        date.getDate() === yesterday.getDate() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getFullYear() === yesterday.getFullYear()
      ) {
        return `Gestern, ${date.toLocaleTimeString('de-DE', {
          hour: '2-digit',
          minute: '2-digit'
        })}`;
      }
      
      // Ansonsten das vollständige Datum anzeigen
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    _handleSearchInput(e: Event) {
      this.searchQuery = (e.target as HTMLInputElement).value;
      this._applyFilters();
    }

    _handleStatusFilterChange(e: Event) {
      this.statusFilter = (e.target as HTMLSelectElement).value;
      this._applyFilters();
    }

    _handleTypeFilterChange(e: Event) {
      this.typeFilter = (e.target as HTMLSelectElement).value;
      this._applyFilters();
    }

    _navigateToAgentDetail(e: Event, id: string) {
      e.preventDefault();
      window.location.href = `/agents/${id}`;
    }

    _navigateToCreateAgent() {
      window.location.href = '/agents/create';
    }

    _downloadAgent() {
      // Hier würde später ein Modal mit Download-Optionen geöffnet werden
      alert('Agent-Download-Funktion wird geöffnet...');
      // In einer echten Implementierung würde hier ein Link zum Download bereitgestellt werden
    }

    _editAgent(e: Event, id: string) {
      e.stopPropagation();
      window.location.href = `/agents/edit/${id}`;
    }

    _deleteAgent(e: Event, id: string) {
      e.stopPropagation();
      if (confirm('Sind Sie sicher, dass Sie diesen Agenten löschen möchten?')) {
        // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
        alert(`Agent mit ID ${id} würde jetzt gelöscht werden.`);
        this.agents = this.agents.filter(agent => agent.id !== id);
        this._applyFilters();
      }
    }

    _manageToken(e: Event, id: string) {
      e.stopPropagation();
      window.location.href = `/tokens?agent=${id}`;
    }
  }
} 