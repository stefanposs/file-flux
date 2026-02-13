import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoJobs } from '../../demo-mode';
import { showToast } from '../shared/toast';
import { api } from '../../services/api-service';

interface Job {
  id: string;
  name: string;
  description: string;
  status: string;
  type: string;
  schedule?: string;
  lastRun?: string;
  nextRun?: string | null;
  source: string;
  destination: string;
  uploadAgent?: string;
  downloadAgent?: string;
  enabled?: boolean;
  transferCount?: number;
  failedCount?: number;
  transferredBytes?: number;
}

@customElement('ff-job-list')
export class JobList extends LitElement {
  @state() private jobs: Job[] = [];
  @state() private filteredJobs: Job[] = [];
  @state() private isLoading = true;
  @state() private error: string | null = null;
  @state() private searchQuery = '';
  @state() private statusFilter = 'all';
  @state() private typeFilter = 'all';
  @state() private isCreateJobModalOpen = false;
  @state() private sortField = '';
  @state() private sortDirection = 'asc';

  static styles = css`
    :host {
      display: block;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    h1 {
      font-size: 24px;
      color: var(--gray-900, #111827);
      margin: 0;
      font-weight: 700;
    }
    
    .add-job-button {
      background-color: var(--primary-color, #4f46e5);
      color: white;
      border: none;
      border-radius: var(--radius-sm, 6px);
      padding: 8px 16px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      transition: background 0.2s;
    }
    
    .add-job-button:hover {
      background-color: var(--primary-hover, #4338ca);
    }
    
    .filters {
      display: flex;
      gap: 16px;
      margin-bottom: 24px;
      flex-wrap: wrap;
    }
    
    .search-box {
      flex-grow: 1;
      position: relative;
    }
    
    .search-input {
      width: 100%;
      padding: 8px 16px 8px 40px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 16px;
    }
    
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #6c757d;
    }
    
    .filter-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .filter-label {
      font-size: 14px;
      color: #666;
    }
    
    .filter-select {
      padding: 8px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      min-width: 120px;
    }
    
    .job-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
      gap: 16px;
    }
    
    .job-card {
      background-color: white;
      border-radius: var(--radius-md, 8px);
      box-shadow: var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      border: 1px solid var(--gray-200, #e5e7eb);
      overflow: hidden;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      cursor: pointer;
    }
    
    .job-card:hover {
      transform: translateY(-2px);
      box-shadow: var(--shadow-md, 0 4px 6px rgba(0,0,0,0.1));
    }
    
    .job-header {
      background: linear-gradient(135deg, var(--primary-color, #4f46e5), var(--primary-dark, #3730a3));
      color: white;
      padding: 16px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .job-name {
      font-weight: 500;
      font-size: 18px;
    }
    
    .job-type {
      background-color: rgba(255, 255, 255, 0.2);
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
    }
    
    .job-body {
      padding: 16px;
    }
    
    .job-description {
      margin-bottom: 16px;
      color: #666;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    .job-details {
      display: flex;
      justify-content: space-between;
      font-size: 14px;
      color: #666;
    }
    
    .job-status {
      display: flex;
      align-items: center;
      gap: 6px;
    }
    
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    
    .status-active {
      background-color: var(--success-color, #10b981);
    }
    
    .status-inactive {
      background-color: var(--gray-400, #9ca3af);
    }
    
    .job-schedule {
      font-style: italic;
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
    
    .empty-message {
      color: #666;
      text-align: center;
    }

    /* Modal styles */
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
      background: #fff;
      border-radius: 8px;
      width: 100%;
      max-width: 520px;
      box-shadow: 0 8px 30px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e9ecef;
    }
    .modal-header h2 { margin: 0; font-size: 18px; color: var(--primary-color, #4f46e5); }
    .modal-close {
      background: none; border: none; font-size: 24px; cursor: pointer; color: #6c757d;
    }
    .modal-body {
      padding: 20px;
    }
    .modal-body .form-group {
      margin-bottom: 16px;
    }
    .modal-body label {
      display: block; margin-bottom: 4px; font-weight: 500; font-size: 14px;
    }
    .modal-body .form-input {
      width: 100%; padding: 8px 12px; border: 1px solid #dee2e6; border-radius: 4px; font-size: 14px;
      box-sizing: border-box;
    }
    .modal-body textarea.form-input { resize: vertical; }
    .modal-footer {
      display: flex; justify-content: flex-end; gap: 8px;
      padding: 12px 20px; border-top: 1px solid #e9ecef;
    }
    .btn-cancel {
      padding: 8px 16px; border: 1px solid #dee2e6; background: #fff;
      border-radius: 4px; cursor: pointer;
    }
    .btn-submit {
      padding: 8px 16px; border: none; background: var(--primary-color, #4f46e5); color: #fff;
      border-radius: 4px; cursor: pointer; font-weight: 500;
    }
    .btn-submit:hover { background: #0a1c33; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadJobs();
  }

  async _loadJobs() {
    try {
      this.isLoading = true;
      
      // Try real API first
      if (api.isAuthenticated()) {
        try {
          const apiJobs = await api.getJobs();
          this.jobs = apiJobs.map(j => ({
            id: String(j.id),
            name: j.name,
            description: j.description || '',
            status: j.status,
            type: j.type,
            schedule: j.schedule || undefined,
            lastRun: j.last_run || undefined,
            nextRun: j.next_run,
            source: j.source_path,
            destination: j.destination_path,
            uploadAgent: j.source_agent_id ? String(j.source_agent_id) : undefined,
            downloadAgent: j.destination_agent_id ? String(j.destination_agent_id) : undefined,
          }));
          this._applyFilters();
          return;
        } catch (apiErr) {
          console.warn('API load failed, falling back to demo', apiErr);
        }
      }

      if (isDemoMode()) {
        // Im Demo-Modus Daten aus den Demo-Daten laden
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simuliere Netzwerklatenz
        this.jobs = getDemoJobs();
      } else {
        this.error = 'Bitte melden Sie sich an.';
      }
      
      this._applyFilters();
    } catch (err) {
      this.error = 'Fehler beim Laden der Jobs: ' + (err?.message || 'Unbekannter Fehler');
      console.error('Error loading jobs:', err);
    } finally {
      this.isLoading = false;
    }
  }

  _applyFilters() {
    if (!this.jobs.length) {
      this.filteredJobs = [];
      return;
    }
    
    let result = [...this.jobs];
    
    // Suchfilter anwenden
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(job => 
        job.name.toLowerCase().includes(query) || 
        job.description.toLowerCase().includes(query) ||
        job.source.toLowerCase().includes(query) ||
        job.destination.toLowerCase().includes(query)
      );
    }
    
    // Statusfilter anwenden
    if (this.statusFilter !== 'all') {
      result = result.filter(job => job.status === this.statusFilter);
    }
    
    // Typfilter anwenden
    if (this.typeFilter !== 'all') {
      result = result.filter(job => job.type === this.typeFilter);
    }
    
    this.filteredJobs = result;
  }

  _formatSchedule(schedule: string): string {
    // Vereinfachte Darstellung von Cron-Ausdrücken
    if (schedule === '0 0 * * *') return 'Täglich';
    if (schedule === '0 12 * * 1-5') return 'Werktags';
    if (schedule === '0 23 * * *') return 'Nachts';
    return schedule;
  }

  _navigateToJobDetail(id: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { route: 'job-detail', id },
      bubbles: true,
      composed: true
    }));
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
            <p>${this.error}</p>
            <button @click=${this._loadJobs}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    return html`
      <div class="header">
        <h1>Transfer-Jobs</h1>
        <button class="add-job-button" @click=${this._openCreateJobModal}>+ Neuen Job erstellen</button>
      </div>
      
      <div class="filters">
        <div class="search-box">
          <span class="search-icon">🔍</span>
          <input 
            type="text" 
            class="search-input" 
            placeholder="Jobs durchsuchen..." 
            .value=${this.searchQuery}
            @input=${e => { 
              this.searchQuery = e.target.value; 
              this._applyFilters(); 
            }}
          >
        </div>
        
        <div class="filter-group">
          <span class="filter-label">Status:</span>
          <select 
            class="filter-select" 
            .value=${this.statusFilter}
            @change=${e => { 
              this.statusFilter = e.target.value; 
              this._applyFilters(); 
            }}
          >
            <option value="all">Alle</option>
            <option value="active">Aktiv</option>
            <option value="inactive">Inaktiv</option>
            <option value="failed">Fehlgeschlagen</option>
          </select>
        </div>
        
        <div class="filter-group">
          <span class="filter-label">Typ:</span>
          <select 
            class="filter-select" 
            .value=${this.typeFilter}
            @change=${e => { 
              this.typeFilter = e.target.value; 
              this._applyFilters(); 
            }}
          >
            <option value="all">Alle</option>
            <option value="push">Push</option>
            <option value="pull">Pull</option>
          </select>
        </div>
      </div>
      
      ${this.isCreateJobModalOpen ? this._renderCreateJobModal() : ''}

      ${this.filteredJobs.length === 0 ? html`
        <div class="empty-container">
          <div class="empty-message">
            <p>Keine Jobs gefunden.</p>
            ${this.searchQuery || this.statusFilter !== 'all' || this.typeFilter !== 'all' ? html`
              <button @click=${() => {
                this.searchQuery = '';
                this.statusFilter = 'all';
                this.typeFilter = 'all';
                this._applyFilters();
              }}>Filter zurücksetzen</button>
            ` : ''}
          </div>
        </div>
      ` : html`
        <div class="job-grid">
          ${this.filteredJobs.map(job => html`
            <div class="job-card" @click=${() => this._navigateToJobDetail(job.id)}>
              <div class="job-header">
                <div class="job-name">${job.name}</div>
                <div class="job-type">${job.type.toUpperCase()}</div>
              </div>
              <div class="job-body">
                <div class="job-description">${job.description}</div>
                <div class="job-details">
                  <div class="job-status">
                    <span class="status-dot status-${job.status}"></span>
                    ${job.status === 'active' ? 'Aktiv' : 'Inaktiv'}
                  </div>
                  <div class="job-schedule">
                    ${job.schedule ? this._formatSchedule(job.schedule) : 'Manuell'}
                  </div>
                </div>
              </div>
            </div>
          `)}
        </div>
      `}
    `;
  }

  _renderJobCard(job: Job) {
    return html`
      <div class="job-card" @click=${() => this._navigateToJobDetail(job.id)}>
        <div class="job-header">
          <div class="job-name">${job.name}</div>
          <div class="job-type">${job.type.toUpperCase()}</div>
        </div>
        <div class="job-body">
          <div class="job-description">${job.description}</div>
          <div class="job-details">
            <div class="job-status">
              <span class="status-dot status-${job.status}"></span>
              ${job.status === 'active' ? 'Aktiv' : 'Inaktiv'}
            </div>
            <div class="job-schedule">
              ${job.schedule ? this._formatSchedule(job.schedule) : 'Manuell'}
            </div>
          </div>
        </div>
      </div>
    `;
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

  _openCreateJobModal() {
    this.isCreateJobModalOpen = true;
  }

  _closeCreateJobModal() {
    this.isCreateJobModalOpen = false;
  }

  _renderCreateJobModal() {
    return html`
      <div class="modal-overlay" @click=${this._closeCreateJobModal}>
        <div class="modal-content" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <h2>Neuen Job erstellen</h2>
            <button class="modal-close" @click=${this._closeCreateJobModal}>&times;</button>
          </div>
          <form @submit=${this._submitJobForm}>
            <div class="modal-body">
              <div class="form-group">
                <label for="job-name">Name *</label>
                <input type="text" id="job-name" class="form-input" required placeholder="z.B. Daily Backup">
              </div>
              <div class="form-group">
                <label for="job-description">Beschreibung</label>
                <textarea id="job-description" class="form-input" rows="3" placeholder="Was macht dieser Job?"></textarea>
              </div>
              <div class="form-group">
                <label for="job-source">Quellpfad *</label>
                <input type="text" id="job-source" class="form-input" required placeholder="/data/quelle">
              </div>
              <div class="form-group">
                <label for="job-destination">Zielpfad *</label>
                <input type="text" id="job-destination" class="form-input" required placeholder="/data/ziel">
              </div>
              <div class="form-group">
                <label for="job-schedule">Zeitplan (Cron) *</label>
                <input type="text" id="job-schedule" class="form-input" required placeholder="0 0 * * *">
              </div>
            </div>
            <div class="modal-footer">
              <button type="button" class="btn-cancel" @click=${this._closeCreateJobModal}>Abbrechen</button>
              <button type="submit" class="btn-submit">Job erstellen</button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  _renderSortIcon(field: string) {
    if (this.sortField !== field) {
      return html`<span class="sort-icon"></span>`;
    }
    
    return html`<span class="sort-icon ${this.sortDirection}"></span>`;
  }

  _sort(field: string) {
    if (this.sortField === field) {
      // Wenn bereits nach diesem Feld sortiert wird, ändere die Richtung
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Ansonsten setze das neue Sortierfeld und Richtung auf aufsteigend
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    
    this._applyFilters();
  }

  _resetFilters() {
    this.searchQuery = '';
    this.statusFilter = 'all';
    this.typeFilter = 'all';
    this._applyFilters();
  }

  _submitJobForm(e: Event) {
    e.preventDefault();
    
    const form = e.target as HTMLFormElement;
    const nameInput = form.querySelector('#job-name') as HTMLInputElement;
    const descriptionInput = form.querySelector('#job-description') as HTMLTextAreaElement;
    const sourceInput = form.querySelector('#job-source') as HTMLInputElement;
    const destinationInput = form.querySelector('#job-destination') as HTMLInputElement;
    const scheduleInput = form.querySelector('#job-schedule') as HTMLInputElement;
    
    if (!nameInput.value || !sourceInput.value || !destinationInput.value || !scheduleInput.value) {
      showToast('Bitte fülle alle erforderlichen Felder aus.', 'warning');
      return;
    }
    
    const newJob: Job = {
      id: `job${this.jobs.length + 1}`,
      name: nameInput.value,
      description: descriptionInput.value,
      source: sourceInput.value,
      destination: destinationInput.value,
      schedule: scheduleInput.value,
      type: 'scheduled',
      status: 'active',
      enabled: true,
      transferCount: 0,
      failedCount: 0,
      transferredBytes: 0,
      lastRun: null,
      nextRun: this._calculateNextRun(scheduleInput.value)
    };
    
    // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
    // await jobService.createJob(newJob);
    
    // Demo-Implementierung
    this.jobs = [...this.jobs, newJob];
    this._applyFilters();
    this._closeCreateJobModal();
    
    showToast('Job erfolgreich erstellt!', 'success');
  }

  _calculateNextRun(cronExpression: string): string {
    // Eine einfache Berechnung für Demo-Zwecke
    // In einer echten Implementierung würde hier eine Cron-Bibliothek verwendet werden
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.toISOString();
  }

  async _toggleJobEnabled(jobId: string, enabled: boolean) {
    try {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      // await jobService.updateJob(jobId, { enabled });
      
      // Demo-Implementierung
      const jobIndex = this.jobs.findIndex(job => job.id === jobId);
      if (jobIndex >= 0) {
        this.jobs = [
          ...this.jobs.slice(0, jobIndex),
          { ...this.jobs[jobIndex], enabled },
          ...this.jobs.slice(jobIndex + 1)
        ];
        this._applyFilters();
      }
    } catch (err) {
      console.error('Error toggling job enabled state:', err);
      showToast('Fehler beim Aktualisieren des Jobs: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  async _runJob(jobId: string) {
    if (!confirm('Möchtest du diesen Job jetzt manuell starten?')) {
      return;
    }
    
    try {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      // await jobService.runJob(jobId);
      
      // Demo-Implementierung
      await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
      
      const now = new Date().toISOString();
      const jobIndex = this.jobs.findIndex(job => job.id === jobId);
      
      if (jobIndex >= 0) {
        this.jobs = [
          ...this.jobs.slice(0, jobIndex),
          { 
            ...this.jobs[jobIndex], 
            lastRun: now,
            transferCount: this.jobs[jobIndex].transferCount + 1
          },
          ...this.jobs.slice(jobIndex + 1)
        ];
        this._applyFilters();
      }
      
      showToast('Job wurde erfolgreich gestartet!', 'success');
    } catch (err) {
      console.error('Error running job:', err);
      showToast('Fehler beim Starten des Jobs: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  _editJob(jobId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/jobs/${jobId}` },
      bubbles: true,
      composed: true
    }));
  }

  async _deleteJob(jobId: string) {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) return;
    
    if (!confirm(`Bist du sicher, dass du den Job "${job.name}" löschen möchtest? Diese Aktion kann nicht rückgängig gemacht werden.`)) {
      return;
    }
    
    try {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      // await jobService.deleteJob(jobId);
      
      // Demo-Implementierung
      await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
      
      this.jobs = this.jobs.filter(j => j.id !== jobId);
      this._applyFilters();
      
      showToast('Job wurde erfolgreich gelöscht!', 'success');
    } catch (err) {
      console.error('Error deleting job:', err);
      showToast('Fehler beim Löschen des Jobs: ' + (err instanceof Error ? err.message : String(err)), 'error');
    }
  }

  _formatDateTime(dateStr: string): string {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch (e) {
      return dateStr;
    }
  }
} 