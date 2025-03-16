import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoJobs } from '../../demo-mode';

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
}

if (!customElements.get('ff-job-list')) {
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
        color: #122e53;
        margin: 0;
      }
      
      .add-job-button {
        background-color: #122e53;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 8px 16px;
        font-weight: 500;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      
      .add-job-button:hover {
        background-color: #0a1c33;
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
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
        overflow: hidden;
        transition: transform 0.2s ease, box-shadow 0.2s ease;
        cursor: pointer;
      }
      
      .job-card:hover {
        transform: translateY(-4px);
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
      }
      
      .job-header {
        background-color: #122e53;
        color: white;
        padding: 16px;
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
        background-color: #28a745;
      }
      
      .status-inactive {
        background-color: #6c757d;
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
    `;

    connectedCallback() {
      super.connectedCallback();
      this._loadJobs();
    }

    async _loadJobs() {
      try {
        this.isLoading = true;
        
        if (isDemoMode()) {
          // Im Demo-Modus Daten aus den Demo-Daten laden
          await new Promise(resolve => setTimeout(resolve, 1000)); // Simuliere Netzwerklatenz
          this.jobs = getDemoJobs();
        } else {
          // Hier würde später der API-Aufruf kommen
          // const jobs = await jobService.getJobs();
          // this.jobs = jobs;
          this.error = 'API noch nicht implementiert';
        }
        
        this._applyFilters();
      } catch (err) {
        this.error = 'Fehler beim Laden der Jobs: ' + (err instanceof Error ? err.message : String(err));
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

    render() {
      return html`<div>Jobs werden geladen...</div>`;
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

    _formatSchedule(schedule: string): string {
      // Vereinfachte Darstellung von Cron-Ausdrücken
      if (schedule === '0 0 * * *') return 'Täglich';
      if (schedule === '0 12 * * 1-5') return 'Werktags';
      if (schedule === '0 23 * * *') return 'Nachts';
      return schedule;
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

    _navigateToJobDetail(id: string) {
      window.location.href = `/jobs/${id}`;
    }

    _openCreateJobModal() {
      this.isCreateJobModalOpen = true;
    }

    _closeCreateJobModal() {
      this.isCreateJobModalOpen = false;
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
        alert('Bitte fülle alle erforderlichen Felder aus.');
        return;
      }
      
      const newJob = {
        id: `job${this.jobs.length + 1}`,
        name: nameInput.value,
        description: descriptionInput.value,
        source: sourceInput.value,
        destination: destinationInput.value,
        schedule: scheduleInput.value,
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
      
      alert('Job erfolgreich erstellt!');
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
        alert('Fehler beim Aktualisieren des Jobs: ' + (err instanceof Error ? err.message : String(err)));
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
        
        alert('Job wurde erfolgreich gestartet!');
      } catch (err) {
        console.error('Error running job:', err);
        alert('Fehler beim Starten des Jobs: ' + (err instanceof Error ? err.message : String(err)));
      }
    }

    _editJob(jobId: string) {
      window.location.href = `/jobs/edit/${jobId}`;
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
        
        alert('Job wurde erfolgreich gelöscht!');
      } catch (err) {
        console.error('Error deleting job:', err);
        alert('Fehler beim Löschen des Jobs: ' + (err instanceof Error ? err.message : String(err)));
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
} 