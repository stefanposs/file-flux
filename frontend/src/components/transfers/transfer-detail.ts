import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers, getDemoJobs, getDemoAgents } from '../../demo-mode';
import { showToast } from '../shared/toast';
import { api } from '../../services/api-service';

@customElement('ff-transfer-detail')
export class TransferDetail extends LitElement {
  @property({ type: String }) transferId = '';
  @state() private isLoading = true;
  @state() private error = null;
  @state() private transfer = null;
  @state() private job = null;
  @state() private sourceAgent = null;
  @state() private destinationAgent = null;
  @state() private progress = 0;
  @state() private transferLogs = [];

  static styles = css`
    :host {
      display: block;
    }
    
    .error-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .error-message {
      color: var(--ff-error);
      text-align: center;
    }
    
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 16px;
    }
    
    .transfer-title {
      font-size: 24px;
      margin: 0;
      color: var(--ff-primary, #4f46e5);
    }
    
    .transfer-actions {
      display: flex;
      gap: 8px;
    }
    
    .action-button {
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .primary-button {
      background-color: var(--ff-primary, #4f46e5);
      color: white;
      border: none;
    }
    
    .secondary-button {
      background-color: white;
      color: var(--ff-gray-900);
      border: 1px solid var(--ff-border);
    }
    
    .danger-button {
      background-color: white;
      color: var(--ff-error);
      border: 1px solid var(--ff-border);
    }
    
    .content-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 18px;
      color: var(--ff-primary, #4f46e5);
      margin-top: 0;
      margin-bottom: 16px;
    }
    
    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .info-item {
      border: 1px solid var(--ff-gray-100);
      border-radius: 8px;
      padding: 16px;
    }
    
    .info-label {
      font-size: 14px;
      color: var(--ff-gray-500);
      margin-bottom: 8px;
    }
    
    .info-value {
      font-size: 16px;
      font-weight: 500;
    }
    
    .transfer-link {
      color: var(--ff-primary, #4f46e5);
      text-decoration: underline;
      cursor: pointer;
    }
    
    .progress-section {
      margin-bottom: 24px;
    }
    
    .progress-container {
      width: 100%;
      height: 10px;
      background-color: var(--ff-gray-100);
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .progress-bar {
      height: 100%;
      background-color: var(--ff-primary, #4f46e5);
      transition: width 0.5s ease;
    }
    
    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: var(--ff-gray-500);
    }
    
    .progress-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 14px;
    }
    
    .log-container {
      background-color: var(--ff-gray-50);
      border-radius: 8px;
      padding: 16px;
      font-family: monospace;
      max-height: 400px;
      overflow-y: auto;
    }
    
    .log-entry {
      display: flex;
      margin-bottom: 8px;
      line-height: 1.5;
    }
    
    .log-timestamp {
      flex-shrink: 0;
      color: var(--ff-gray-500);
      margin-right: 12px;
    }
    
    .log-message {
      word-break: break-word;
    }
    
    .log-level-info {
      color: var(--ff-info);
    }
    
    .log-level-warning {
      color: var(--ff-warning);
    }
    
    .log-level-error {
      color: var(--ff-error);
    }
    
    .files-section {
      margin-top: 24px;
    }
    
    .file-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .file-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      border-bottom: 1px solid var(--ff-gray-100);
    }
    
    .file-item:last-child {
      border-bottom: none;
    }
    
    .file-name {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .file-icon {
      font-size: 20px;
    }
    
    .file-size {
      color: var(--ff-gray-500);
      font-size: 14px;
    }
    
    .empty-message {
      padding: 16px;
      text-align: center;
      color: var(--ff-gray-500);
    }

    @media (max-width: 768px) {
      .info-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadTransferData();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._progressInterval) {
      clearInterval(this._progressInterval);
    }
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
    }
  }

  _progressInterval = null;
  _pollTimer: ReturnType<typeof setInterval> | null = null;

  _startPolling() {
    if (this._pollTimer) return;
    this._pollTimer = setInterval(async () => {
      if (!api.isAuthenticated()) return;
      try {
        const t = await api.getTransfer(Number(this.transferId));
        this.progress = Math.round(t.progress * 100);
        this.transfer = {
          ...this.transfer,
          status: t.status,
          progress: t.progress,
          error: t.error || undefined,
          endTime: t.end_time || undefined,
        };
        // Stop polling when transfer is no longer active
        if (t.status === 'completed' || t.status === 'failed') {
          if (this._pollTimer) {
            clearInterval(this._pollTimer);
            this._pollTimer = null;
          }
        }
      } catch (e) {
        console.warn('Poll failed', e);
      }
    }, 2000);
  }

  async _loadTransferData() {
    try {
      this.isLoading = true;
      
      // Try real API first
      if (api.isAuthenticated()) {
        try {
          const apiTransfer = await api.getTransfer(Number(this.transferId));
          if (apiTransfer) {
            this.transfer = {
              id: String(apiTransfer.id),
              jobId: String(apiTransfer.job_id),
              filename: apiTransfer.filename,
              size: apiTransfer.size,
              status: apiTransfer.status,
              startTime: apiTransfer.start_time,
              endTime: apiTransfer.end_time || undefined,
              progress: apiTransfer.progress,
              error: apiTransfer.error || undefined,
            };
            this.progress = Math.round(apiTransfer.progress * 100);

            // Start polling if transfer is active
            if (apiTransfer.status === 'pending' || apiTransfer.status === 'running') {
              this._startPolling();
            }

            // Load related job
            if (apiTransfer.job_id) {
              try {
                const j = await api.getJob(apiTransfer.job_id);
                if (j) this.job = { id: String(j.id), name: j.name };
              } catch (e) {
                console.warn('Failed to load job for transfer', e);
              }
            }
            // Load related agents
            try {
              const apiAgents = await api.getAgents();
              if (apiTransfer.source_agent_id) {
                const sa = apiAgents.find(a => a.id === apiTransfer.source_agent_id);
                if (sa) this.sourceAgent = { id: String(sa.id), name: sa.name };
              }
              if (apiTransfer.destination_agent_id) {
                const da = apiAgents.find(a => a.id === apiTransfer.destination_agent_id);
                if (da) this.destinationAgent = { id: String(da.id), name: da.name };
              }
            } catch (e) {
              console.warn('Failed to load agents for transfer', e);
            }
          } else {
            this.error = 'Transfer nicht gefunden';
          }
          return;
        } catch (apiErr) {
          console.warn('API load failed, falling back to demo', apiErr);
        }
      }

      if (isDemoMode()) {
        // Simuliere Netzwerklatenz
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const transfers = getDemoTransfers();
        const transfer = transfers.find(t => t.id === this.transferId);
        
        if (transfer) {
          this.transfer = transfer;
          
          // Progress-Simulation für laufende Transfers
          if (transfer.status === 'running') {
            this.progress = Math.floor(Math.random() * 90); // Zufälliger Fortschritt zwischen 0-90%
            this._progressInterval = setInterval(() => {
              if (this.progress < 100) {
                this.progress += Math.floor(Math.random() * 5) + 1;
                if (this.progress >= 100) {
                  this.progress = 100;
                  clearInterval(this._progressInterval);
                  // Aktualisiere den Transfer-Status
                  this.transfer = { ...this.transfer, status: 'completed' };
                }
                this.requestUpdate();
              }
            }, 1500);
          } else if (transfer.status === 'completed' || transfer.status === 'failed') {
            this.progress = 100;
          } else {
            this.progress = 0;
          }
          
          // Lade zugehörigen Job
          if (transfer.jobId) {
            const jobs = getDemoJobs();
            this.job = jobs.find(j => j.id === transfer.jobId);
          }
          
          // Lade zugehörige Agents
          const agents = getDemoAgents();
          if (transfer.sourceAgentId) {
            this.sourceAgent = agents.find(a => a.id === transfer.sourceAgentId);
          }
          if (transfer.destinationAgentId) {
            this.destinationAgent = agents.find(a => a.id === transfer.destinationAgentId);
          }
          
          // Generiere Demo-Logs
          this._generateDemoLogs();
        } else {
          this.error = 'Transfer nicht gefunden';
        }
      } else {
        // Hier würde später der API-Aufruf kommen
        this.error = 'Bitte melden Sie sich an.';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden des Transfers: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading transfer:', err);
    } finally {
      this.isLoading = false;
    }
  }

  _generateDemoLogs() {
    const transfer = this.transfer;
    if (!transfer) return;
    
    const logs = [];
    const startTime = new Date(transfer.startTime).getTime();
    const endTime = transfer.endTime ? new Date(transfer.endTime).getTime() : new Date().getTime();
    const duration = endTime - startTime;
    
    // Startnachricht
    logs.push({
      timestamp: new Date(startTime).toISOString(),
      level: 'info',
      message: `Transfer gestartet: "${transfer.filename}" (${this._formatFileSize(transfer.size)})`
    });
    
    // Initialisierung
    logs.push({
      timestamp: new Date(startTime + 500).toISOString(),
      level: 'info',
      message: `Verbindung zum Ziel-Agent hergestellt`
    });
    
    if (transfer.status === 'completed' || transfer.status === 'running') {
      // Fortschritt
      const progressTime = startTime + (duration * 0.3);
      logs.push({
        timestamp: new Date(progressTime).toISOString(),
        level: 'info',
        message: `Übertragung läuft - 30% abgeschlossen (${this._formatFileSize(transfer.size * 0.3)} übertragen)`
      });
      
      const progressTime2 = startTime + (duration * 0.6);
      logs.push({
        timestamp: new Date(progressTime2).toISOString(),
        level: 'info',
        message: `Übertragung läuft - 60% abgeschlossen (${this._formatFileSize(transfer.size * 0.6)} übertragen)`
      });
    }
    
    // Fehlgeschlagene Transfers
    if (transfer.status === 'failed') {
      const errorTime = startTime + (duration * 0.7);
      logs.push({
        timestamp: new Date(errorTime).toISOString(),
        level: 'warning',
        message: `Netzwerkinstabilität erkannt - Versuche erneute Verbindung...`
      });
      
      logs.push({
        timestamp: new Date(errorTime + 5000).toISOString(),
        level: 'error',
        message: `Verbindung zum Ziel-Agent verloren. Transfer fehlgeschlagen.`
      });
    }
    
    // Abschluss
    if (transfer.status === 'completed') {
      logs.push({
        timestamp: new Date(endTime - 1000).toISOString(),
        level: 'info',
        message: `Dateiintegrität wird geprüft...`
      });
      
      logs.push({
        timestamp: new Date(endTime).toISOString(),
        level: 'info',
        message: `Transfer erfolgreich abgeschlossen. Übertragene Datenmenge: ${this._formatFileSize(transfer.size)}`
      });
    }
    
    // Sortiere Logs nach Zeitstempel
    this.transferLogs = logs.sort((a, b) => 
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );
  }

  _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    return date.toLocaleString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  _formatLogTime(dateStr) {
    if (!dateStr) return '-';
    
    const date = new Date(dateStr);
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _formatSpeed(bytesPerSecond) {
    return this._formatFileSize(bytesPerSecond) + '/s';
  }

  _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path },
      bubbles: true,
      composed: true
    }));
  }

  _navigateBack() {
    this._navigate('/transfers');
  }

  _navigateToJob(jobId) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/jobs/${jobId}` },
      bubbles: true,
      composed: true
    }));
  }

  _navigateToAgent(agentId) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/agents/${agentId}` },
      bubbles: true,
      composed: true
    }));
  }

  _cancelTransfer() {
    if (confirm('Möchten Sie diesen Transfer wirklich abbrechen?')) {
      showToast('Transfer wurde abgebrochen.', 'warning');
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      clearInterval(this._progressInterval);
      this.transfer = { ...this.transfer, status: 'failed' };
      this.progress = this.progress; // Den Fortschritt einfrieren
      this._generateDemoLogs(); // Logs aktualisieren
    }
  }

  _retryTransfer() {
    if (confirm('Möchten Sie diesen Transfer wiederholen?')) {
      showToast('Transfer wird wiederholt.', 'info');
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      // Aktualisiere den Status und setze den Fortschritt zurück
      this.transfer = { 
        ...this.transfer, 
        status: 'running',
        startTime: new Date().toISOString(),
        endTime: null
      };
      this.progress = 0;
      
      // Starte die Fortschritts-Simulation
      this._progressInterval = setInterval(() => {
        if (this.progress < 100) {
          this.progress += Math.floor(Math.random() * 5) + 1;
          if (this.progress >= 100) {
            this.progress = 100;
            clearInterval(this._progressInterval);
            // Aktualisiere den Transfer-Status
            this.transfer = { 
              ...this.transfer, 
              status: 'completed',
              endTime: new Date().toISOString()
            };
          }
          this.requestUpdate();
        }
      }, 1500);
      
      this._generateDemoLogs(); // Logs aktualisieren
    }
  }

  render() {
    if (this.isLoading) {
      return html`<ff-loading-spinner></ff-loading-spinner>`;
    }

    if (this.error) {
      return html`
        <div class="error-container">
          <div class="error-message">
            <div>🚫 ${this.error}</div>
            <button @click=${this._loadTransferData}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    if (!this.transfer) {
      return html`
        <div class="error-container">
          <div class="error-message">
            <div>Transfer nicht gefunden</div>
            <button @click=${this._navigateBack}>Zurück zur Transfer-Liste</button>
          </div>
        </div>
      `;
    }

    const isActive = this.transfer.status === 'running' || this.transfer.status === 'pending';
    const canRetry = this.transfer.status === 'failed';
    const transferDuration = this.transfer.endTime && this.transfer.startTime
      ? (new Date(this.transfer.endTime).getTime() - new Date(this.transfer.startTime).getTime()) / 1000
      : null;

    return html`
      <div>
        <ff-breadcrumb .items=${[
          { label: 'Transfers', path: '/transfers' },
          { label: this.transfer?.filename || 'Transfer' }
        ]} @navigate=${(e: CustomEvent) => this._navigate(e.detail.path)}></ff-breadcrumb>

        <div class="header">
          <h1 class="transfer-title">${this.transfer.filename}</h1>
          
          <div class="transfer-actions">
            ${isActive ? html`
              <button class="action-button danger-button" @click=${this._cancelTransfer}>
                ⏹️ Transfer abbrechen
              </button>
            ` : ''}
            
            ${canRetry ? html`
              <button class="action-button primary-button" @click=${this._retryTransfer}>
                🔄 Transfer wiederholen
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="content-container">
          <h2 class="section-title">Transfer-Informationen</h2>
          
          <div class="info-grid">
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">
                <ff-status-badge status="${this.transfer.status}"></ff-status-badge>
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Größe</div>
              <div class="info-value">${this._formatFileSize(this.transfer.size)}</div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Startzeit</div>
              <div class="info-value">${this._formatDateTime(this.transfer.startTime)}</div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Endzeit</div>
              <div class="info-value">
                ${this.transfer.endTime ? this._formatDateTime(this.transfer.endTime) : '-'}
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Dauer</div>
              <div class="info-value">
                ${transferDuration !== null ? this._formatDuration(transferDuration) : '-'}
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Durchschnittsgeschwindigkeit</div>
              <div class="info-value">
                ${this.transfer.status === 'completed' && transferDuration ? 
                  this._formatSpeed(this.transfer.size / transferDuration) : 
                  '-'
                }
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Zugehöriger Job</div>
              <div class="info-value">
                ${this.job ? html`
                  <a class="transfer-link" @click=${() => this._navigateToJob(this.job.id)}>
                    ${this.job.name}
                  </a>
                ` : 'Manueller Transfer'}
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Quelle</div>
              <div class="info-value">
                ${this.sourceAgent ? html`
                  <a class="transfer-link" @click=${() => this._navigateToAgent(this.sourceAgent.id)}>
                    ${this.sourceAgent.name}
                  </a>
                ` : this.transfer.source || '-'}
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Ziel</div>
              <div class="info-value">
                ${this.destinationAgent ? html`
                  <a class="transfer-link" @click=${() => this._navigateToAgent(this.destinationAgent.id)}>
                    ${this.destinationAgent.name}
                  </a>
                ` : this.transfer.destination || '-'}
              </div>
            </div>
          </div>
          
          <div class="progress-section">
            <h3 class="section-title">Fortschritt</h3>
            <div class="progress-container">
              <div class="progress-bar" style="width: ${this.progress}%"></div>
            </div>
            <div class="progress-info">
              <span>${this.progress}% abgeschlossen</span>
              <span>${this._formatFileSize(Math.floor(this.transfer.size * this.progress / 100))} / ${this._formatFileSize(this.transfer.size)}</span>
            </div>
          </div>
        </div>
        
        <div class="content-container">
          <h2 class="section-title">Transfer-Logs</h2>
          ${this.transferLogs.length > 0 ? html`
            <div class="log-container">
              ${this.transferLogs.map(log => html`
                <div class="log-entry">
                  <span class="log-timestamp">${this._formatLogTime(log.timestamp)}</span>
                  <span class="log-message log-level-${log.level}">${log.message}</span>
                </div>
              `)}
            </div>
          ` : html`
            <div class="empty-message">Keine Logs verfügbar.</div>
          `}
        </div>
      </div>
    `;
  }

  _formatDuration(seconds) {
    if (seconds < 60) {
      return `${Math.floor(seconds)} Sekunden`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = Math.floor(seconds % 60);
      return `${minutes} Minuten ${remainingSeconds} Sekunden`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      return `${hours} Stunden ${minutes} Minuten`;
    }
  }
} 