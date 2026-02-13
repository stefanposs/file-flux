import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoJobs, getDemoTransfers } from '../../demo-mode';
import { showToast } from '../shared/toast';
import { api } from '../../services/api-service';

@customElement('ff-job-detail')
export class JobDetail extends LitElement {
  @property({ type: String }) jobId = '';
  @state() private isLoading = true;
  @state() private job = null;
  @state() private error = null;
  @state() private recentTransfers = [];
  @state() private showConfirmDelete = false;
  @state() private showScheduleInfo = false;

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
    
    .job-name {
      font-size: 24px;
      margin: 0;
      color: var(--primary-color, #4f46e5);
    }
    
    .job-actions {
      display: flex;
      gap: 8px;
    }
    
    .job-action-button {
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .primary-button {
      background-color: var(--primary-color, #4f46e5);
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
    
    .job-detail-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      padding: 24px;
      margin-bottom: 24px;
    }
    
    .section-title {
      font-size: 18px;
      color: var(--primary-color, #4f46e5);
      margin-top: 0;
      margin-bottom: 16px;
    }
    
    .job-info-grid {
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
    
    .status-active {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .status-inactive {
      background-color: rgba(108, 117, 125, 0.1);
      color: #6c757d;
    }
    
    .status-error {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    
    .status-paused {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .type-push {
      background-color: rgba(13, 110, 253, 0.1);
      color: #0d6efd;
    }
    
    .type-pull {
      background-color: rgba(108, 117, 125, 0.1);
      color: #6c757d;
    }
    
    .description-container {
      margin-bottom: 24px;
    }
    
    .description-text {
      line-height: 1.5;
      margin: 0;
      white-space: pre-wrap;
    }
    
    .schedule-info {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      color: #6c757d;
      font-size: 14px;
    }
    
    .schedule-tooltip {
      position: absolute;
      background-color: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      padding: 12px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      z-index: 10;
      width: 250px;
      white-space: normal;
    }
    
    .transfers-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .transfers-table th,
    .transfers-table td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .transfers-table th {
      color: #6c757d;
      font-weight: 500;
    }
    
    .transfers-table tr:hover {
      background-color: #f8f9fa;
    }
    
    .transfer-status {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
    }
    
    .transfer-status-completed {
      background-color: rgba(40, 167, 69, 0.1);
      color: #28a745;
    }
    
    .transfer-status-failed {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
    }
    
    .transfer-status-running {
      background-color: rgba(13, 110, 253, 0.1);
      color: #0d6efd;
    }
    
    .transfer-status-pending {
      background-color: rgba(217, 119, 6, 0.1);
      color: #92400e;
    }
    
    .config-section {
      margin-top: 24px;
    }
    
    .config-item {
      margin-bottom: 16px;
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
    
    .view-all-link {
      display: block;
      text-align: right;
      margin-top: 10px;
      color: var(--primary-color, #4f46e5);
      text-decoration: underline;
      cursor: pointer;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadJobData();
  }

  async _loadJobData() {
    try {
      this.isLoading = true;
      
      // Try real API first
      if (api.isAuthenticated()) {
        try {
          const apiJobs = await api.getJobs();
          const apiJob = apiJobs.find(j => String(j.id) === this.jobId);
          if (apiJob) {
            this.job = {
              id: String(apiJob.id),
              name: apiJob.name,
              description: apiJob.description || '',
              status: apiJob.status,
              type: apiJob.type,
              schedule: apiJob.schedule || undefined,
              lastRun: apiJob.last_run || undefined,
              nextRun: apiJob.next_run,
              source: apiJob.source_path,
              destination: apiJob.destination_path,
            };
            // Load related transfers
            try {
              const apiTransfers = await api.getTransfers();
              this.recentTransfers = apiTransfers
                .filter(t => String(t.job_id) === this.jobId)
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
                }))
                .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
                .slice(0, 10);
            } catch (e) {
              console.warn('Failed to load transfers for job', e);
            }
          } else {
            this.error = 'Job nicht gefunden';
          }
          return;
        } catch (apiErr) {
          console.warn('API load failed, falling back to demo', apiErr);
        }
      }

      if (isDemoMode()) {
        // Simuliere Netzwerklatenz
        await new Promise(resolve => setTimeout(resolve, 800));
        
        const jobs = getDemoJobs();
        const job = jobs.find(j => j.id === this.jobId);
        
        if (job) {
          this.job = job;
          
          // Lade zugehörige Transfers
          const transfers = getDemoTransfers();
          this.recentTransfers = transfers
            .filter(t => t.jobId === this.jobId)
            .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
            .slice(0, 10);
        } else {
          this.error = 'Job nicht gefunden';
        }
      } else {
        // Hier würde später der API-Aufruf kommen
        this.error = 'Bitte melden Sie sich an.';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden des Jobs: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading job:', err);
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
            <button @click=${this._loadJobData}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    if (!this.job) {
      return html`
        <div class="error-container">
          <div class="error-message">
            <div>Job nicht gefunden</div>
            <button @click=${this._navigateBack}>Zurück zur Job-Liste</button>
          </div>
        </div>
      `;
    }

    return html`
      <div>
        <div class="header">
          <button class="back-button" @click=${this._navigateBack}>
            ← Zurück zur Job-Liste
          </button>
          
          <h1 class="job-name">${this.job.name}</h1>
          
          <div class="job-actions">
            <button class="job-action-button primary-button" @click=${this._runJob}>
              ▶️ Job ausführen
            </button>
            
            <button class="job-action-button secondary-button" @click=${this._editJob}>
              ✏️ Bearbeiten
            </button>
            
            <button class="job-action-button danger-button" @click=${this._showDeleteConfirm}>
              🗑️ Löschen
            </button>
          </div>
        </div>
        
        <div class="job-detail-container">
          <h2 class="section-title">Job-Informationen</h2>
          
          <div class="job-info-grid">
            <div class="info-item">
              <div class="info-label">Status</div>
              <div class="info-value">
                <span class="status-badge status-${this.job.status}">
                  ${this._formatStatus(this.job.status)}
                </span>
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Typ</div>
              <div class="info-value">
                <span class="type-badge type-${this.job.type}">
                  ${this.job.type === 'push' ? 'Push (Upload)' : 'Pull (Download)'}
                </span>
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Zeitplan</div>
              <div class="info-value">
                <div @mouseenter=${this._showScheduleTooltip} @mouseleave=${this._hideScheduleTooltip}>
                  ${this.job.schedule ? this._formatSchedule(this.job.schedule) : 'Manuell'}
                  <span class="schedule-info">ℹ️</span>
                  
                  ${this.showScheduleInfo ? html`
                    <div class="schedule-tooltip">
                      ${this.job.schedule ? 
                        this._formatScheduleExplanation(this.job.schedule) : 
                        'Dieser Job wird nur manuell ausgeführt und hat keinen automatischen Zeitplan.'
                      }
                    </div>
                  ` : ''}
                </div>
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Zuletzt ausgeführt</div>
              <div class="info-value">
                ${this.job.lastRun ? this._formatDateTime(this.job.lastRun) : 'Nie'}
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Nächste Ausführung</div>
              <div class="info-value">
                ${this.job.nextRun ? this._formatDateTime(this.job.nextRun) : '-'}
              </div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Quelle</div>
              <div class="info-value">${this.job.source}</div>
            </div>
            
            <div class="info-item">
              <div class="info-label">Ziel</div>
              <div class="info-value">${this.job.destination}</div>
            </div>
          </div>
          
          <div class="description-container">
            <h3 class="section-title">Beschreibung</h3>
            <p class="description-text">${this.job.description || 'Keine Beschreibung vorhanden.'}</p>
          </div>
        </div>
        
        <div class="job-detail-container">
          <h2 class="section-title">Letzte Transfers</h2>
          
          ${this.recentTransfers.length === 0 ? html`
            <p>Keine Transfers für diesen Job gefunden.</p>
          ` : html`
            <table class="transfers-table">
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Größe</th>
                  <th>Startzeit</th>
                  <th>Endzeit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.recentTransfers.map(transfer => html`
                  <tr @click=${() => this._navigateToTransfer(transfer.id)}>
                    <td>${transfer.filename}</td>
                    <td>${this._formatFileSize(transfer.size)}</td>
                    <td>${this._formatDateTime(transfer.startTime)}</td>
                    <td>${transfer.endTime ? this._formatDateTime(transfer.endTime) : '-'}</td>
                    <td>
                      <span class="transfer-status transfer-status-${transfer.status}">
                        ${this._formatTransferStatus(transfer.status)}
                      </span>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
            
            <a class="view-all-link" @click=${this._viewAllTransfers}>Alle Transfers anzeigen</a>
          `}
        </div>
        
        ${this.showConfirmDelete ? html`
          <div class="confirm-delete-overlay">
            <div class="confirm-delete-dialog">
              <div class="confirm-delete-title">Job löschen?</div>
              <div class="confirm-delete-message">
                Sind Sie sicher, dass Sie den Job "${this.job.name}" löschen möchten? 
                Diese Aktion kann nicht rückgängig gemacht werden.
              </div>
              <div class="confirm-delete-actions">
                <button 
                  class="job-action-button secondary-button" 
                  @click=${this._cancelDelete}
                >
                  Abbrechen
                </button>
                <button 
                  class="job-action-button danger-button" 
                  @click=${this._confirmDelete}
                >
                  Löschen
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }

  _formatStatus(status) {
    switch (status) {
      case 'active': return 'Aktiv';
      case 'inactive': return 'Inaktiv';
      case 'error': return 'Fehler';
      case 'paused': return 'Pausiert';
      default: return status;
    }
  }

  _formatTransferStatus(status) {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'failed': return 'Fehlgeschlagen';
      case 'running': return 'Wird ausgeführt';
      case 'pending': return 'Ausstehend';
      default: return status;
    }
  }

  _formatSchedule(schedule) {
    // Vereinfachte Darstellung für Cron-Ausdrücke
    if (schedule === '0 0 * * *') return 'Täglich um Mitternacht';
    if (schedule === '0 12 * * *') return 'Täglich um 12 Uhr';
    if (schedule === '0 0 * * 1') return 'Jeden Montag';
    if (schedule === '0 0 1 * *') return 'Monatlich am 1.';
    if (schedule === '0 0 * * 1-5') return 'Montag bis Freitag';
    if (schedule === '0 0 1,15 * *') return 'Am 1. und 15. jeden Monats';
    
    return schedule;
  }

  _formatScheduleExplanation(schedule) {
    // Detaillierte Erklärung des Cron-Ausdrucks
    const explanations = {
      '0 0 * * *': 'Dieser Job wird täglich um Mitternacht (00:00 Uhr) ausgeführt.',
      '0 12 * * *': 'Dieser Job wird täglich um 12 Uhr mittags ausgeführt.',
      '0 0 * * 1': 'Dieser Job wird jeden Montag um Mitternacht ausgeführt.',
      '0 0 1 * *': 'Dieser Job wird am ersten Tag jedes Monats um Mitternacht ausgeführt.',
      '0 0 * * 1-5': 'Dieser Job wird montags bis freitags um Mitternacht ausgeführt.',
      '0 0 1,15 * *': 'Dieser Job wird am 1. und 15. jedes Monats um Mitternacht ausgeführt.'
    };
    
    return explanations[schedule] || `Cron-Ausdruck: ${schedule}`;
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

  _formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _navigateBack() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: '/jobs' },
      bubbles: true,
      composed: true
    }));
  }

  _editJob() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/jobs/edit/${this.jobId}` },
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
    showToast(`Job "${this.job?.name}" gelöscht.`, 'success');
    this.showConfirmDelete = false;
    this._navigateBack();
  }

  _navigateToTransfer(transferId) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/transfers/${transferId}` },
      bubbles: true,
      composed: true
    }));
  }

  _viewAllTransfers() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/transfers?jobId=${this.jobId}` },
      bubbles: true,
      composed: true
    }));
  }

  _runJob() {
    if (confirm(`Möchten Sie den Job "${this.job.name}" jetzt ausführen?`)) {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      showToast('Job wird ausgeführt...', 'info');
    }
  }

  _showScheduleTooltip() {
    this.showScheduleInfo = true;
  }

  _hideScheduleTooltip() {
    this.showScheduleInfo = false;
  }
} 