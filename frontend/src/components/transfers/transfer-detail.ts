import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers, getDemoJobs, getDemoAgents } from '../../demo-mode';

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
      color: #122e53;
      cursor: pointer;
      font-size: 14px;
      padding: 0;
      display: flex;
      align-items: center;
      text-decoration: underline;
    }
    
    .transfer-title {
      font-size: 24px;
      margin: 0;
      color: #122e53;
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
      background-color: #122e53;
      color: white;
      border: none;
    }
    
    .secondary-button {
      background-color: white;
      color: #212529;
      border: 1px solid #dee2e6;
    }
    
    .danger-button {
      background-color: white;
      color: #dc3545;
      border: 1px solid #dee2e6;
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
      color: #122e53;
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
      border: 1px solid #f0f0f0;
      border-radius: 8px;
      padding: 16px;
    }
    
    .info-label {
      font-size: 14px;
      color: #6c757d;
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
    
    .status-completed {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .status-failed {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    
    .status-running {
      background-color: rgba(13, 110, 253, 0.1);
      color: #0d6efd;
    }
    
    .status-pending {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .transfer-link {
      color: #122e53;
      text-decoration: underline;
      cursor: pointer;
    }
    
    .progress-section {
      margin-bottom: 24px;
    }
    
    .progress-container {
      width: 100%;
      height: 10px;
      background-color: #f0f0f0;
      border-radius: 5px;
      overflow: hidden;
      margin-bottom: 8px;
    }
    
    .progress-bar {
      height: 100%;
      background-color: #122e53;
      transition: width 0.5s ease;
    }
    
    .progress-info {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: #6c757d;
    }
    
    .progress-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 14px;
    }
    
    .log-container {
      background-color: #f8f9fa;
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
      color: #6c757d;
      margin-right: 12px;
    }
    
    .log-message {
      word-break: break-word;
    }
    
    .log-level-info {
      color: #0d6efd;
    }
    
    .log-level-warning {
      color: #ffc107;
    }
    
    .log-level-error {
      color: #dc3545;
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
      border-bottom: 1px solid #f0f0f0;
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
      color: #6c757d;
      font-size: 14px;
    }
    
    .empty-message {
      padding: 16px;
      text-align: center;
      color: #6c757d;
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
  }

  _progressInterval = null;

  async _loadTransferData() {
    try {
      this.isLoading = true;
      
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
        this.error = 'API noch nicht implementiert. Bitte aktiviere den Demo-Modus.';
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

  _formatStatus(status) {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'failed': return 'Fehlgeschlagen';
      case 'running': return 'Wird ausgeführt';
      case 'pending': return 'Ausstehend';
      default: return status;
    }
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

  _navigateBack() {
    window.location.href = '/transfers';
  }

  _navigateToJob(jobId) {
    window.location.href = `/jobs/${jobId}`;
  }

  _navigateToAgent(agentId) {
    window.location.href = `/agents/${agentId}`;
  }

  _cancelTransfer() {
    if (confirm('Möchten Sie diesen Transfer wirklich abbrechen?')) {
      alert('Transfer wurde abgebrochen.');
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      clearInterval(this._progressInterval);
      this.transfer = { ...this.transfer, status: 'failed' };
      this.progress = this.progress; // Den Fortschritt einfrieren
      this._generateDemoLogs(); // Logs aktualisieren
    }
  }

  _retryTransfer() {
    if (confirm('Möchten Sie diesen Transfer wiederholen?')) {
      alert('Transfer wird wiederholt.');
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
        <div class="header">
          <button class="back-button" @click=${this._navigateBack}>
            ← Zurück zur Transfer-Liste
          </button>
          
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
                <span class="status-badge status-${this.transfer.status}">
                  ${this._formatStatus(this.transfer.status)}
                </span>
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