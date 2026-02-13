import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoAgents, getDemoTransfers, getDemoTokens } from '../../demo-mode';
import { showToast } from '../shared/toast';
import { api } from '../../services/api-service';

@customElement('ff-agent-detail')
export class AgentDetail extends LitElement {
  @property({ type: String }) agentId = '';
  @state() private isLoading = true;
  @state() private agent = null;
  @state() private error = null;
  @state() private tokens = [];
  @state() private transfers = [];
  @state() private activeTab = 'overview';
  @state() private showConfirmDelete = false;

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
    
    .token-status-expiring_soon {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }

    .loading-container, .error-container {
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
      border-left-color: var(--primary-color, #4f46e5);
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
    
    .confirm-delete-overlay {
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

    .confirm-delete-dialog {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      padding: 24px;
      width: 400px;
      max-width: 90%;
    }

    .confirm-delete-title {
      font-size: 18px;
      font-weight: 500;
      margin-bottom: 16px;
      color: #dc3545;
    }

    .confirm-delete-message {
      margin-bottom: 24px;
    }

    .confirm-delete-actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }

    .confirm-delete-cancel {
      padding: 8px 16px;
      background-color: #f8f9fa;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      cursor: pointer;
    }

    .confirm-delete-confirm {
      padding: 8px 16px;
      background-color: #dc3545;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .back-button {
      background: none;
      border: none;
      color: var(--primary-color, #4f46e5);
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      display: flex;
      align-items: center;
      text-decoration: underline;
    }
    
    .agent-name {
      font-size: 24px;
      margin: 0;
      color: var(--primary-color, #4f46e5);
    }
    
    .agent-actions {
      display: flex;
      gap: 8px;
    }
    
    .agent-action-button {
      padding: 8px 12px;
      background-color: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .agent-action-button:hover {
      background-color: #f8f9fa;
    }
    
    .delete-button {
      color: #dc3545;
    }
    
    .tabs {
      display: flex;
      border-bottom: 1px solid #dee2e6;
      margin-bottom: 20px;
    }
    
    .tab {
      padding: 12px 20px;
      cursor: pointer;
      color: #6c757d;
    }
    
    .tab.active {
      color: var(--primary-color, #4f46e5);
      border-bottom: 2px solid var(--primary-color, #4f46e5);
      font-weight: 500;
    }
    
    .tab-content {
      padding: 20px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .section-title {
      color: var(--primary-color, #4f46e5);
      margin-top: 0;
    }
    
    .overview-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .info-item {
      background-color: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
    }
    
    .info-label {
      color: #6c757d;
      font-size: 14px;
      margin-bottom: 8px;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 500;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .status-online {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .status-offline {
      background-color: rgba(108, 117, 125, 0.1);
      color: #6c757d;
    }
    
    .status-completed {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .status-failed {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    
    .status-running {
      background-color: rgba(0, 123, 255, 0.1);
      color: #007bff;
    }
    
    .status-pending {
      background-color: rgba(217, 119, 6, 0.1);
      color: #92400e;
    }
    
    .agent-type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .type-upload {
      background-color: rgba(23, 162, 184, 0.1);
      color: #17a2b8;
    }
    
    .type-download {
      background-color: rgba(111, 66, 193, 0.1);
      color: #6f42c1;
    }
    
    .transfers-table, .tokens-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .transfers-table th, .transfers-table td,
    .tokens-table th, .tokens-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    
    .transfers-table th, .tokens-table th {
      color: #6c757d;
      font-weight: 500;
    }
    
    .transfers-table tr:hover, .tokens-table tr:hover {
      background-color: #f8f9fa;
    }
    
    .token-status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .token-status-active {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .token-status-expired {
      background-color: rgba(108, 117, 125, 0.1);
      color: #6c757d;
    }
    
    .token-status-expiring_soon {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .token-actions {
      display: flex;
      gap: 4px;
    }
    
    .action-button {
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .action-button:hover {
      background-color: #f8f9fa;
    }
    
    .renew-button:hover {
      color: #28a745;
    }
    
    .revoke-button:hover {
      color: #dc3545;
    }
    
    .config-example {
      background-color: #f8f9fa;
      padding: 16px;
      border-radius: 8px;
      font-family: monospace;
      white-space: pre;
      overflow-x: auto;
      margin-bottom: 20px;
    }
    
    .copy-button {
      padding: 8px 16px;
      background-color: var(--primary-color, #4f46e5);
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      margin-bottom: 30px;
    }
    
    .copy-button:hover {
      background-color: #0b1d36;
    }
    
    .error-details {
      margin-top: 4px;
      font-size: 14px;
      color: #dc3545;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
  }

  async _loadData() {
    try {
      this.isLoading = true;
      
      // Try real API first
      if (api.isAuthenticated()) {
        try {
          const apiAgents = await api.getAgents();
          const apiAgent = apiAgents.find(a => String(a.id) === this.agentId);
          if (apiAgent) {
            this.agent = {
              id: String(apiAgent.id),
              name: apiAgent.name,
              type: apiAgent.type,
              status: apiAgent.status,
              ipAddress: apiAgent.ip_address || '',
              system: apiAgent.system || '',
              version: apiAgent.version || '',
              lastSeen: apiAgent.last_seen,
              description: apiAgent.description,
            };
            // Load related transfers
            try {
              const apiTransfers = await api.getTransfers();
              this.transfers = apiTransfers
                .filter(t => String(t.job_id) === this.agentId)
                .map(t => ({
                  id: String(t.id),
                  jobId: String(t.job_id),
                  filename: t.filename,
                  size: t.size,
                  status: t.status,
                  startTime: t.start_time,
                  endTime: t.end_time || undefined,
                  progress: 0,
                  error: t.error || undefined,
                }));
            } catch (e) {
              console.warn('Failed to load transfers for agent', e);
            }
            // Load related tokens
            try {
              const apiTokens = await api.getTokens();
              this.tokens = apiTokens
                .filter(t => t.agent_id === apiAgent.id)
                .map(t => ({
                  id: String(t.id),
                  name: t.name,
                  token: t.value,
                  agentId: t.agent_id ? String(t.agent_id) : null,
                  status: (t.expires_at && new Date(t.expires_at) < new Date()) ? 'expired' : 'active',
                  createdAt: t.created_at,
                  expiresAt: t.expires_at,
                  lastUsedAt: t.last_used,
                }));
            } catch (e) {
              console.warn('Failed to load tokens for agent', e);
            }
          } else {
            this.error = 'Agent nicht gefunden';
          }
          return;
        } catch (apiErr) {
          console.warn('API load failed, falling back to demo', apiErr);
        }
      }

      if (isDemoMode()) {
        // Im Demo-Modus Daten aus den Demo-Daten laden
        await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
        const allAgents = getDemoAgents();
        const agent = allAgents.find(a => a.id === this.agentId);
        
        if (agent) {
          this.agent = agent;
          
          // Transfers für diesen Agenten filtern
          const allTransfers = getDemoTransfers();
          this.transfers = allTransfers.filter(t => 
            (agent.type === 'upload' && t.source.includes(agent.id)) || 
            (agent.type === 'download' && t.destination.includes(agent.id))
          );
          
          // Tokens für diesen Agenten filtern
          const allTokens = getDemoTokens();
          this.tokens = allTokens.filter(t => t.agentId === agent.id);
        } else {
          this.error = 'Agent nicht gefunden';
        }
      } else {
        // Hier würde später der API-Aufruf kommen
        this.error = 'Bitte melden Sie sich an.';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden des Agenten: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading agent:', err);
    } finally {
      this.isLoading = false;
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
        <div class="error-container">
          <div class="error-message">
            <div>🚫 ${this.error}</div>
            <button @click=${this._loadData}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    if (!this.agent) {
      return html`
        <div class="error-container">
          <div class="error-message">
            <div>Agent nicht gefunden</div>
            <button @click=${this._navigateBack}>Zurück zur Agentenliste</button>
          </div>
        </div>
      `;
    }

    return html`
      <div>
        <div class="header">
          <button class="back-button" @click=${this._navigateBack}>
            ← Zurück zur Agentenliste
          </button>
          
          <h1 class="agent-name">${this.agent.name}</h1>
          
          <div class="agent-actions">
            <button class="agent-action-button test-button" @click=${this._testConnection}>
              🔄 Verbindung testen
            </button>
            <button class="agent-action-button token-button" @click=${this._createToken}>
              🔑 Token erstellen
            </button>
            <button class="agent-action-button edit-button" @click=${this._editAgent}>
              ✏️ Bearbeiten
            </button>
            <button class="agent-action-button delete-button" @click=${this._showDeleteConfirm}>
              🗑️ Löschen
            </button>
          </div>
        </div>
        
        <div class="tabs">
          <div class="tab ${this.activeTab === 'overview' ? 'active' : ''}" @click=${() => this.activeTab = 'overview'}>Übersicht</div>
          <div class="tab ${this.activeTab === 'transfers' ? 'active' : ''}" @click=${() => this.activeTab = 'transfers'}>Transfers</div>
          <div class="tab ${this.activeTab === 'tokens' ? 'active' : ''}" @click=${() => this.activeTab = 'tokens'}>Tokens</div>
          <div class="tab ${this.activeTab === 'configuration' ? 'active' : ''}" @click=${() => this.activeTab = 'configuration'}>Konfiguration</div>
        </div>
        
        ${this.activeTab === 'overview' ? this._renderOverviewTab() : ''}
        ${this.activeTab === 'transfers' ? this._renderTransfersTab() : ''}
        ${this.activeTab === 'tokens' ? this._renderTokensTab() : ''}
        ${this.activeTab === 'configuration' ? this._renderConfigurationTab() : ''}
        
        ${this.showConfirmDelete ? html`
          <div class="confirm-delete-overlay">
            <div class="confirm-delete-dialog">
              <div class="confirm-delete-title">Agent löschen?</div>
              <div class="confirm-delete-message">
                Sind Sie sicher, dass Sie den Agenten "${this.agent.name}" löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden.
                
                <p>Alle zugehörigen Tokens werden widerrufen und der Agent wird keine Verbindung mehr herstellen können.</p>
              </div>
              <div class="confirm-delete-actions">
                <button class="confirm-delete-cancel" @click=${this._cancelDelete}>Abbrechen</button>
                <button class="confirm-delete-confirm" @click=${this._confirmDelete}>Löschen</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _renderOverviewTab() {
    return html`
      <div class="tab-content">
        <div class="overview-grid">
          <div class="info-item">
            <div class="info-label">Status</div>
            <div class="info-value">
              <span class="status-badge status-${this.agent?.status}">
                ${this.agent?.status === 'online' ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Typ</div>
            <div class="info-value">
              <span class="agent-type-badge type-${this.agent?.type}">
                ${this.agent?.type === 'upload' ? 'Upload' : 'Download'}
              </span>
            </div>
          </div>
          
          <div class="info-item">
            <div class="info-label">System</div>
            <div class="info-value">${this.agent?.system}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">IP-Adresse</div>
            <div class="info-value">${this.agent?.ipAddress}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Zuletzt gesehen</div>
            <div class="info-value">${this._formatDateTime(this.agent?.lastSeen)}</div>
          </div>
          
          <div class="info-item">
            <div class="info-label">Aktive Tokens</div>
            <div class="info-value">${this.tokens.filter(t => t.status === 'active').length}</div>
          </div>
        </div>
        
        <h3 class="section-title">Letzte Aktivitäten</h3>
        
        ${this.transfers.length === 0 ? html`
          <p>Keine Transfers für diesen Agenten gefunden.</p>
        ` : html`
          <table class="transfers-table">
            <thead>
              <tr>
                <th>Datei</th>
                <th>Größe</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${this.transfers.slice(0, 5).map(transfer => html`
                <tr>
                  <td>${transfer.filename}</td>
                  <td>${this._formatFileSize(transfer.size)}</td>
                  <td>${this._formatDateTime(transfer.startTime)}</td>
                  <td>${transfer.endTime ? this._formatDateTime(transfer.endTime) : '-'}</td>
                  <td>
                    <span class="status-badge status-${transfer.status}">
                      ${this._formatStatus(transfer.status)}
                    </span>
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  _renderTransfersTab() {
    return html`
      <div class="tab-content">
        <h3 class="section-title">Transfer-Historie</h3>
        
        ${this.transfers.length === 0 ? html`
          <p>Keine Transfers für diesen Agenten gefunden.</p>
        ` : html`
          <table class="transfers-table">
            <thead>
              <tr>
                <th>Datei</th>
                <th>Größe</th>
                <th>Start</th>
                <th>Ende</th>
                <th>Geschwindigkeit</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${this.transfers.map(transfer => html`
                <tr>
                  <td>${transfer.filename}</td>
                  <td>${this._formatFileSize(transfer.size)}</td>
                  <td>${this._formatDateTime(transfer.startTime)}</td>
                  <td>${transfer.endTime ? this._formatDateTime(transfer.endTime) : '-'}</td>
                  <td>${transfer.speed > 0 ? this._formatSpeed(transfer.speed) : '-'}</td>
                  <td>
                    <span class="status-badge status-${transfer.status}">
                      ${this._formatStatus(transfer.status)}
                    </span>
                    ${transfer.error ? html`
                      <div class="error-details">${transfer.error}</div>
                    ` : ''}
                  </td>
                </tr>
              `)}
            </tbody>
          </table>
        `}
      </div>
    `;
  }

  _renderTokensTab() {
    return html`
      <div class="tab-content">
        <div class="header" style="margin-top: 0;">
          <h3 class="section-title" style="margin: 0;">Tokens</h3>
          <button class="agent-action-button token-button" @click=${this._createToken}>
            + Neues Token erstellen
          </button>
        </div>
        
        ${this.tokens.length === 0 ? html`
          <p>Keine Tokens für diesen Agenten gefunden.</p>
        ` : html`
          <table class="tokens-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Erstellt am</th>
                <th>Zuletzt verwendet</th>
                <th>Gültig bis</th>
                <th>Status</th>
                <th>Aktionen</th>
              </tr>
            </thead>
            <tbody>
              ${this.tokens.map(token => html`
                <tr>
                  <td>${token.name}</td>
                  <td>${this._formatDate(token.created)}</td>
                  <td>${this._formatDate(token.lastUsed)}</td>
                  <td>${this._formatDate(token.expiresAt)}</td>
                  <td>
                    <span class="token-status-badge token-status-${token.status}">
                      ${this._formatTokenStatus(token.status)}
                    </span>
                  </td>
                  <td>
                    <div class="token-actions">
                      <button class="action-button renew-button" title="Erneuern" @click=${() => this._renewToken(token.id)}>
                        🔄
                      </button>
                      <button class="action-button revoke-button" title="Widerrufen" @click=${() => this._revokeToken(token.id)}>
                        ❌
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

  _renderConfigurationTab() {
    return html`
      <div class="tab-content">
        <h3 class="section-title">Agent-Konfiguration</h3>
        
        <p>Verwenden Sie die folgende Konfiguration, um Ihren Agenten zu starten:</p>
        
        <div class="config-example">
${this._generateAgentConfig()}
        </div>
        
        <button class="copy-button" @click=${this._copyConfigToClipboard}>
          In Zwischenablage kopieren
        </button>
        
        <h3 class="section-title">Installation</h3>
        
        <p>Führen Sie die folgenden Schritte aus, um den Agenten zu installieren:</p>
        
        <ol>
          <li>Laden Sie die neueste Version des Agenten herunter: <a href="#">fileflux-agent herunterladen</a></li>
          <li>Extrahieren Sie die Dateien auf Ihren Server</li>
          <li>Erstellen Sie eine Konfigurationsdatei mit den obigen Einstellungen</li>
          <li>Starten Sie den Agenten mit dem Befehl: <code>./fileflux-agent --config config.yaml</code></li>
        </ol>
      </div>
    `;
  }

  _generateAgentConfig() {
    const tokenPlaceholder = this.tokens.length > 0 ? this.tokens[0].id : 'HIER_TOKEN_EINFÜGEN';
    
    return `# File Flux Agent Konfiguration
agentId: ${this.agent?.id}
name: ${this.agent?.name}
type: ${this.agent?.type}
token: ${tokenPlaceholder}

# Server-Einstellungen
server:
  url: https://fileflux.example.com/api
  heartbeatInterval: 60 # Sekunden

# Logging-Einstellungen
logging:
  level: info
  file: fileflux-agent.log
  maxSize: 10 # MB
  maxBackups: 3

# Transfer-Einstellungen
transfers:
  chunkSize: 8 # MB
  compression: true
  retryAttempts: 3
  retryDelay: 10 # Sekunden`;
  }

  async _copyConfigToClipboard() {
    const config = this._generateAgentConfig();
    
    try {
      await navigator.clipboard.writeText(config);
      showToast('Konfiguration in die Zwischenablage kopiert!', 'success');
    } catch (err) {
      console.error('Failed to copy config:', err);
      
      // Fallback für Browser, die die Clipboard API nicht unterstützen
      const textArea = document.createElement('textarea');
      textArea.value = config;
      textArea.style.position = 'fixed';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        showToast('Konfiguration in die Zwischenablage kopiert!', 'success');
      } catch (e) {
        console.error('Failed to copy using execCommand:', e);
        showToast('Konnte nicht in die Zwischenablage kopieren.', 'error');
      }
      
      document.body.removeChild(textArea);
    }
  }

  _formatStatus(status) {
    switch (status) {
      case 'completed': return 'Erfolgreich';
      case 'failed': return 'Fehlgeschlagen';
      case 'running': return 'Wird ausgeführt';
      case 'pending': return 'Ausstehend';
      default: return status;
    }
  }

  _formatTokenStatus(status) {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'expired': return 'Abgelaufen';
      case 'expiring_soon': return 'Läuft bald ab';
      default: return status;
    }
  }

  _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
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
        minute: '2-digit',
        second: '2-digit'
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
        minute: '2-digit',
        second: '2-digit'
      })}`;
    }
    
    // Ansonsten das vollständige Datum anzeigen
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  _formatDate(dateStr) {
    const date = new Date(dateStr);
    return date.toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _formatSpeed(bytesPerSecond) {
    return this._formatFileSize(bytesPerSecond) + '/s';
  }

  _navigateBack() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: '/agents' },
      bubbles: true,
      composed: true
    }));
  }

  _testConnection() {
    showToast('Verbindungstest wird durchgeführt...', 'info');
    
    // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
    setTimeout(() => {
      showToast('Verbindungstest erfolgreich!', 'success');
    }, 1500);
  }

  _createToken() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/tokens?agent=${this.agentId}` },
      bubbles: true,
      composed: true
    }));
  }

  _editAgent() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/agents/edit/${this.agentId}` },
      bubbles: true,
      composed: true
    }));
  }

  _showDeleteConfirm() {
    this.showConfirmDelete = true;
  }

  _cancelDelete() {
    this.showConfirmDelete = false;
  }

  _confirmDelete() {
    // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
    showToast(`Agent "${this.agent?.name}" gelöscht.`, 'success');
    this.showConfirmDelete = false;
    this._navigateBack();
  }

  async _renewToken(tokenId) {
    if (!confirm('Möchten Sie dieses Token wirklich erneuern? Das bestehende Token bleibt gültig, wird aber durch ein neues Token mit verlängerter Gültigkeit ergänzt.')) {
      return;
    }
    
    try {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      // const response = await tokenService.renewToken(tokenId);
      
      // Demo-Implementierung
      // Simulierte Verzögerung
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
      
      showToast('Token erfolgreich erneuert!', 'success');
    } catch (err) {
      showToast('Fehler beim Erneuern des Tokens: ' + (err instanceof Error ? err.message : String(err)), 'error');
      console.error('Error renewing token:', err);
    }
  }

  async _revokeToken(tokenId) {
    if (!confirm('Sind Sie sicher, dass Sie dieses Token widerrufen möchten? Diese Aktion kann nicht rückgängig gemacht werden und das Token wird sofort ungültig.')) {
      return;
    }
    
    try {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      // await tokenService.revokeToken(tokenId);
      
      // Demo-Implementierung
      // Simulierte Verzögerung
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Entferne das Token aus der Liste
      this.tokens = this.tokens.filter(token => token.id !== tokenId);
      
      showToast('Token erfolgreich widerrufen!', 'success');
    } catch (err) {
      showToast('Fehler beim Widerrufen des Tokens: ' + (err instanceof Error ? err.message : String(err)), 'error');
      console.error('Error revoking token:', err);
    }
  }
} 