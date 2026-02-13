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
    
    .job-name {
      font-size: 24px;
      margin: 0;
      color: var(--ff-primary, #4f46e5);
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
    
    .job-detail-container {
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
    
    .job-info-grid {
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
    
    .type-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 14px;
    }
    
    .type-push {
      background-color: var(--ff-info-light);
      color: var(--ff-info);
    }
    
    .type-pull {
      background-color: var(--ff-gray-100);
      color: var(--ff-gray-500);
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
      color: var(--ff-gray-500);
      font-size: 14px;
    }
    
    .schedule-tooltip {
      position: absolute;
      background-color: white;
      border: 1px solid var(--ff-border);
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
      border-bottom: 1px solid var(--ff-gray-100);
    }
    
    .transfers-table th {
      color: var(--ff-gray-500);
      font-weight: 500;
    }
    
    .transfers-table tr:hover {
      background-color: var(--ff-gray-50);
    }
    
    .config-section {
      margin-top: 24px;
    }
    
    .config-item {
      margin-bottom: 16px;
    }
    
    .view-all-link {
      display: block;
      text-align: right;
      margin-top: 10px;
      color: var(--ff-primary, #4f46e5);
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
      return html`<ff-loading-spinner></ff-loading-spinner>`;
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
        <ff-breadcrumb .items=${[
          { label: 'Jobs', path: '/jobs' },
          { label: this.job?.name || 'Job' }
        ]} @navigate=${(e: CustomEvent) => this._navigate(e.detail.path)}></ff-breadcrumb>

        <div class="header">
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
                <ff-status-badge status="${this.job.status}"></ff-status-badge>
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
            <ff-empty-state
              icon="↗"
              title="Keine Transfers"
              description="Es wurden noch keine Transfers für diesen Job ausgeführt."
            ></ff-empty-state>
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
                      <ff-status-badge status="${transfer.status}"></ff-status-badge>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
            
            <a class="view-all-link" @click=${this._viewAllTransfers}>Alle Transfers anzeigen</a>
          `}
        </div>
        
        <ff-confirm-dialog
          ?open=${this.showConfirmDelete}
          title="Job löschen?"
          message="Sind Sie sicher, dass Sie den Job '${this.job.name}' löschen möchten? Diese Aktion kann nicht rückgängig gemacht werden."
          confirmLabel="Löschen"
          type="danger"
          @confirm=${this._confirmDelete}
          @cancel=${() => this.showConfirmDelete = false}
        ></ff-confirm-dialog>
      </div>
    `;
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

  _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path },
      bubbles: true,
      composed: true
    }));
  }

  _navigateBack() {
    this._navigate('/jobs');
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

  async _confirmDelete() {
    try {
      await api.deleteJob(Number(this.jobId));
      showToast(`Job "${this.job?.name}" gelöscht.`, 'success');
      this.showConfirmDelete = false;
      this._navigateBack();
    } catch (err) {
      showToast('Fehler beim Löschen: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
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

  async _runJob() {
    if (confirm(`Möchten Sie den Job "${this.job.name}" jetzt ausführen?`)) {
      try {
        await api.runJob(Number(this.jobId));
        showToast('Job wird ausgeführt...', 'success');
        // Job-Daten neu laden
        this._loadJobData();
      } catch (err) {
        showToast('Fehler beim Starten: ' + (err instanceof Error ? err.message : String(err)), 'error');
      }
    }
  }

  _showScheduleTooltip() {
    this.showScheduleInfo = true;
  }

  _hideScheduleTooltip() {
    this.showScheduleInfo = false;
  }
} 