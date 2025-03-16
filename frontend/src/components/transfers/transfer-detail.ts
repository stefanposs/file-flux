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
      word-break: break-word;
    }
    
    .detail-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      padding: 24px;
    }
    
    .section-title {
      font-size: 18px;
      color: #122e53;
      margin-top: 0;
      margin-bottom: 16px;
    }
    
    .details-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 24px;
    }
    
    .detail-item {
      border: 1px solid #e9ecef;
      border-radius: 8px;
      padding: 12px;
    }
    
    .detail-label {
      font-size: 14px;
      color: #6c757d;
      margin-bottom: 4px;
    }
    
    .detail-value {
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
      background-color: rgba(0, 123, 255, 0.1);
      color: #007bff;
    }
    
    .status-pending {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .error-details {
      background-color: rgba(220, 53, 69, 0.05);
      border-left: 3px solid #dc3545;
      padding: 12px;
      margin-top: 16px;
      margin-bottom: 24px;
    }
    
    .error-title {
      color: #dc3545;
      font-weight: 500;
      margin-top: 0;
      margin-bottom: 8px;
    }
    
    .error-message {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }
    
    .progress-container {
      margin: 24px 0;
    }
    
    .progress-bar {
      height: 8px;
      background-color: #e9ecef;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .progress-fill {
      height: 100%;
      background-color: #122e53;
      transition: width 0.3s ease;
    }
    
    .progress-stats {
      display: flex;
      justify-content: space-between;
      margin-top: 8px;
      font-size: 14px;
      color: #6c757d;
    }
    
    .log-container {
      background-color: #f8f9fa;
      border-radius: 4px;
      padding: 16px;
      max-height: 300px;
      overflow-y: auto;
      font-family: monospace;
      font-size: 14px;
      white-space: pre-wrap;
      line-height: 1.5;
    }
    
    .log-entry {
      margin-bottom: 8px;
    }
    
    .log-timestamp {
      color: #6c757d;
      margin-right: 8px;
    }
    
    .log-level-info {
      color: #17a2b8;
    }
    
    .log-level-warning {
      color: #ffc107;
    }
    
    .log-level-error {
      color: #dc3545;
    }
    
    .action-button {
      padding: 8px 16px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      margin-right: 8px;
      border: none;
    }
    
    .retry-button {
      background-color: #122e53;
      color: white;
    }
    
    .cancel-button {
      background-color: #dc3545;
      color: white;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadTransfer();
  }

  async _loadTransfer() {
    try {
      this.isLoading = true;
      
      if (isDemoMode()) {
        // Simuliere eine Netzwerklatenz
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const transfers = getDemoTransfers();
        const transfer = transfers.find(t => t.id === this.transferId);
        
        if (transfer) {
          // Generiere zufällige Log-Einträge für die Demo
          const logs = [];
          const startTime = new Date(transfer.startTime);
          
          // Log-Einträge nur für abgeschlossene, fehlgeschlagene oder laufende Transfers
          if (['completed', 'failed', 'running'].includes(transfer.status)) {
            logs.push(this._createLogEntry(startTime, 'info', 'Transfer gestartet'));
            logs.push(this._createLogEntry(new Date(startTime.getTime() + 2000), 'info', `Verbindung mit Agent hergestellt`));
            
            if (transfer.status === 'running') {
              logs.push(this._createLogEntry(new Date(startTime.getTime() + 5000), 'info', `Dateiübertragung gestartet: ${transfer.filename}`));
              logs.push(this._createLogEntry(new Date(startTime.getTime() + 10000), 'info', `Übertragen: 32% (${this._formatFileSize(transfer.size * 0.32)})`));
            }
            
            if (transfer.status === 'completed') {
              logs.push(this._createLogEntry(new Date(startTime.getTime() + 5000), 'info', `Dateiübertragung gestartet: ${transfer.filename}`));
              logs.push(this._createLogEntry(new Date(startTime.getTime() + 15000), 'info', `Übertragen: 100% (${this._formatFileSize(transfer.size)})`));
              logs.push(this._createLogEntry(new Date(transfer.endTime), 'info', 'Transfer erfolgreich abgeschlossen'));
            }
            
            if (transfer.status === 'failed') {
              logs.push(this._createLogEntry(new Date(startTime.getTime() + 5000), 'info', `Dateiübertragung gestartet: ${transfer.filename}`));
              logs.push(this._createLogEntry(new Date(startTime.getTime() + 8000), 'warning', `Langsame Übertragungsgeschwindigkeit: ${this._formatFileSize(transfer.speed || 1024 * 50)}/s`));
              logs.push(this._createLogEntry(new Date(transfer.endTime), 'error', transfer.error || 'Verbindung unterbrochen'));
            }
          }
          
          // Erweiterter Transfer mit Logs
          this.transfer = {
            ...transfer,
            logs,
            progress: transfer.status === 'completed' ? 100 : (
              transfer.status === 'running' ? Math.floor(Math.random() * 80) + 20 : 0
            )
          };
        } else {
          this.error = 'Transfer nicht gefunden';
        }
      } else {
        // Hier würde später der API-Aufruf kommen
        this.error = 'API noch nicht implementiert';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden des Transfers: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading transfer:', err);
    } finally {
      this.isLoading = false;
    }
  }

  _createLogEntry(timestamp, level, message) {
    return {
      timestamp,
      level,
      message
    };
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
            <button @click=${this._loadTransfer}>Erneut versuchen</button>
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

    return html`
      <div>
        <div class="header">
          <button class="back-button" @click=${this._navigateBack}>
            ← Zurück zur Transfer-Liste
          </button>
          
          <h1 class="transfer-title">${this.transfer.filename}</h1>
          
          <div class="transfer-actions">
            ${this.transfer.status === 'failed' ? html`
              <button class="action-button retry-button" @click=${this._retryTransfer}>
                Transfer wiederholen
              </button>
            ` : ''}
            
            ${this.transfer.status === 'running' || this.transfer.status === 'pending' ? html`
              <button class="action-button cancel-button" @click=${this._cancelTransfer}>
                Transfer abbrechen
              </button>
            ` : ''}
          </div>
        </div>
        
        <div class="detail-container">
          <h2 class="section-title">Transfer-Details</h2>
          
          <div class="details-grid">
            <div class="detail-item">
              <div class="detail-label">Status</div>
              <div class="detail-value">
                <span class="status-badge status-${this.transfer.status}">
                  ${this._formatStatus(this.transfer.status)}
                </span>
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Größe</div>
              <div class="detail-value">${this._formatFileSize(this.transfer.size)}</div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Start</div>
              <div class="detail-value">${this._formatDateTime(this.transfer.startTime)}</div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Ende</div>
              <div class="detail-value">
                ${this.transfer.endTime ? this._formatDateTime(this.transfer.endTime) : '-'}
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Durchschnittliche Geschwindigkeit</div>
              <div class="detail-value">
                ${this.transfer.speed ? this._formatSpeed(this.transfer.speed) : '-'}
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Quelle</div>
              <div class="detail-value" title="${this.transfer.source}">
                ${this._formatAgentName(this.transfer.source)}
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Ziel</div>
              <div class="detail-value" title="${this.transfer.destination}">
                ${this._formatAgentName(this.transfer.destination)}
              </div>
            </div>
            
            <div class="detail-item">
              <div class="detail-label">Job</div>
              <div class="detail-value">
                ${this.transfer.jobId ? html`
                  <a href="/jobs/${this.transfer.jobId}">${this.transfer.jobName || this.transfer.jobId}</a>
                ` : '-'}
              </div>
            </div>
          </div>
          
          ${this.transfer.status === 'running' ? html`
            <div class="progress-container">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${this.transfer.progress}%"></div>
              </div>
              <div class="progress-stats">
                <span>${this.transfer.progress}%</span>
                <span>${this._formatFileSize(this.transfer.size * this.transfer.progress / 100)} / ${this._formatFileSize(this.transfer.size)}</span>
              </div>
            </div>
          ` : ''}
          
          ${this.transfer.error ? html`
            <div class="error-details">
              <h3 class="error-title">Fehlermeldung</h3>
              <p class="error-message">${this.transfer.error}</p>
            </div>
          ` : ''}
          
          ${this.transfer.logs && this.transfer.logs.length > 0 ? html`
            <h2 class="section-title">Transfer-Log</h2>
            <div class="log-container">
              ${this.transfer.logs.map(log => html`
                <div class="log-entry">
                  <span class="log-timestamp">[${this._formatLogTime(log.timestamp)}]</span>
                  <span class="log-level log-level-${log.level}">[${log.level.toUpperCase()}]</span>
                  <span class="log-message">${log.message}</span>
                </div>
              `)}
            </div>
          ` : ''}
        </div>
      </div>
    `;
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

  _formatAgentName(agentId) {
    // Im Demo-Modus zeigen wir einfach den ID-String
    // In einer echten Implementierung würden wir hier den Agenten-Namen nachschlagen
    return agentId || '-';
  }

  _navigateBack() {
    window.location.href = '/transfers';
  }

  _retryTransfer() {
    if (confirm('Möchten Sie diesen Transfer wirklich wiederholen?')) {
      alert('Transfer würde jetzt wiederholt werden (Demo-Modus)');
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
    }
  }

  _cancelTransfer() {
    if (confirm('Möchten Sie diesen Transfer wirklich abbrechen?')) {
      alert('Transfer würde jetzt abgebrochen werden (Demo-Modus)');
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
    }
  }
} 