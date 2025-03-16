import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers, getDemoJobs } from '../../demo-mode';

interface Transfer {
  id: string;
  jobId: string;
  filename: string;
  size: number;
  status: string;
  startTime: string;
  endTime?: string;
  speed: number;
  error?: string;
  source: string;
  destination: string;
}

interface Job {
  id: string;
  name: string;
}

@customElement('ff-transfer-list')
export class TransferList extends LitElement {
  @state() private transfers: Transfer[] = [];
  @state() private filteredTransfers: Transfer[] = [];
  @state() private jobs: Job[] = [];
  @state() private isLoading = true;
  @state() private error: string | null = null;
  @state() private searchQuery = '';
  @state() private statusFilter = 'all';
  @state() private jobFilter = 'all';
  @state() private timeFilter = 'all';
  @state() private sortField = 'startTime';
  @state() private sortDirection = 'desc';

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
    
    .transfer-table {
      width: 100%;
      border-collapse: collapse;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .transfer-table th {
      text-align: left;
      padding: 12px 16px;
      background-color: #f8f9fa;
      border-bottom: 1px solid #dee2e6;
      color: #666;
      font-weight: 500;
      cursor: pointer;
      user-select: none;
    }
    
    .transfer-table th:hover {
      background-color: #e9ecef;
    }
    
    .sort-indicator {
      display: inline-block;
      margin-left: 4px;
    }
    
    .transfer-table td {
      padding: 12px 16px;
      border-bottom: 1px solid #dee2e6;
    }
    
    .transfer-table tr:last-child td {
      border-bottom: none;
    }
    
    .transfer-table tr:hover {
      background-color: #f8f9fa;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
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
      background-color: rgba(23, 162, 184, 0.1);
      color: #17a2b8;
    }
    
    .status-pending {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .error-details {
      color: #dc3545;
      font-size: 14px;
      margin-top: 4px;
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
    
    .pagination {
      display: flex;
      justify-content: center;
      margin-top: 24px;
      gap: 8px;
    }
    
    .pagination-button {
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      background-color: white;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .pagination-button:hover {
      background-color: #f8f9fa;
    }
    
    .pagination-button.active {
      background-color: #122e53;
      color: white;
      border-color: #122e53;
    }
    
    .pagination-button:disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
  }

  async _loadData() {
    try {
      this.isLoading = true;
      
      if (isDemoMode()) {
        // Im Demo-Modus Daten aus den Demo-Daten laden
        await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
        this.transfers = getDemoTransfers();
        const allJobs = getDemoJobs();
        this.jobs = allJobs.map(job => ({
          id: job.id,
          name: job.name
        }));
      } else {
        // Hier würde später der API-Aufruf kommen
        // const transfers = await transferService.getTransfers();
        // const jobs = await jobService.getJobs();
        // this.transfers = transfers;
        // this.jobs = jobs.map(job => ({ id: job.id, name: job.name }));
        this.error = 'API noch nicht implementiert';
      }
      
      this._applyFilters();
    } catch (err) {
      this.error = 'Fehler beim Laden der Transfers: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading transfers:', err);
    } finally {
      this.isLoading = false;
    }
  }

  _applyFilters() {
    if (!this.transfers.length) {
      this.filteredTransfers = [];
      return;
    }
    
    let result = [...this.transfers];
    
    // Suchfilter anwenden
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      result = result.filter(transfer => 
        transfer.filename.toLowerCase().includes(query) ||
        transfer.source.toLowerCase().includes(query) ||
        transfer.destination.toLowerCase().includes(query)
      );
    }
    
    // Statusfilter anwenden
    if (this.statusFilter !== 'all') {
      result = result.filter(transfer => transfer.status === this.statusFilter);
    }
    
    // Jobfilter anwenden
    if (this.jobFilter !== 'all') {
      result = result.filter(transfer => transfer.jobId === this.jobFilter);
    }
    
    // Zeitfilter anwenden
    if (this.timeFilter !== 'all') {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      if (this.timeFilter === 'today') {
        result = result.filter(transfer => new Date(transfer.startTime) >= startOfToday);
      } else if (this.timeFilter === 'yesterday') {
        const startOfYesterday = new Date(startOfToday);
        startOfYesterday.setDate(startOfYesterday.getDate() - 1);
        result = result.filter(transfer => 
          new Date(transfer.startTime) >= startOfYesterday && 
          new Date(transfer.startTime) < startOfToday
        );
      } else if (this.timeFilter === 'last7days') {
        const startOfLast7Days = new Date(startOfToday);
        startOfLast7Days.setDate(startOfLast7Days.getDate() - 7);
        result = result.filter(transfer => new Date(transfer.startTime) >= startOfLast7Days);
      } else if (this.timeFilter === 'last30days') {
        const startOfLast30Days = new Date(startOfToday);
        startOfLast30Days.setDate(startOfLast30Days.getDate() - 30);
        result = result.filter(transfer => new Date(transfer.startTime) >= startOfLast30Days);
      }
    }
    
    // Sortierung anwenden
    result.sort((a, b) => {
      let aValue: any = a[this.sortField as keyof Transfer];
      let bValue: any = b[this.sortField as keyof Transfer];
      
      // Spezialbehandlung für bestimmte Felder
      if (this.sortField === 'size' || this.sortField === 'speed') {
        return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        if (this.sortField === 'startTime' || this.sortField === 'endTime') {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        } else {
          return this.sortDirection === 'asc' 
            ? aValue.localeCompare(bValue) 
            : bValue.localeCompare(aValue);
        }
      }
      
      return this.sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    });
    
    this.filteredTransfers = result;
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

    return html`
      <div>
        <div class="header">
          <h1>Transfers</h1>
        </div>
        
        <div class="filters">
          <div class="search-box">
            <span class="search-icon">🔍</span>
            <input 
              type="text" 
              class="search-input" 
              placeholder="Transfers durchsuchen..."
              .value=${this.searchQuery}
              @input=${this._handleSearchInput}
            >
          </div>
          
          <div class="filter-group">
            <span class="filter-label">Status:</span>
            <select class="filter-select" @change=${this._handleStatusFilterChange}>
              <option value="all">Alle</option>
              <option value="completed">Erfolgreich</option>
              <option value="failed">Fehlgeschlagen</option>
              <option value="running">Wird ausgeführt</option>
              <option value="pending">Ausstehend</option>
            </select>
          </div>
          
          <div class="filter-group">
            <span class="filter-label">Job:</span>
            <select class="filter-select" @change=${this._handleJobFilterChange}>
              <option value="all">Alle</option>
              ${this.jobs.map(job => html`
                <option value=${job.id}>${job.name}</option>
              `)}
            </select>
          </div>
          
          <div class="filter-group">
            <span class="filter-label">Zeitraum:</span>
            <select class="filter-select" @change=${this._handleTimeFilterChange}>
              <option value="all">Alle</option>
              <option value="today">Heute</option>
              <option value="yesterday">Gestern</option>
              <option value="last7days">Letzte 7 Tage</option>
              <option value="last30days">Letzte 30 Tage</option>
            </select>
          </div>
        </div>
        
        ${this.filteredTransfers.length === 0 ? html`
          <div class="empty-container">
            <div class="empty-message">
              <div>Keine Transfers gefunden.</div>
              ${this.searchQuery || this.statusFilter !== 'all' || this.jobFilter !== 'all' || this.timeFilter !== 'all'
                ? html`<div>Versuchen Sie, Ihre Filterkriterien anzupassen.</div>` 
                : html`<div>Es wurden noch keine Transfers durchgeführt.</div>`
              }
            </div>
          </div>
        ` : html`
          <table class="transfer-table">
            <thead>
              <tr>
                <th @click=${() => this._handleSort('filename')}>
                  Datei ${this._getSortIndicator('filename')}
                </th>
                <th @click=${() => this._handleSort('size')}>
                  Größe ${this._getSortIndicator('size')}
                </th>
                <th>Job</th>
                <th @click=${() => this._handleSort('startTime')}>
                  Start ${this._getSortIndicator('startTime')}
                </th>
                <th @click=${() => this._handleSort('endTime')}>
                  Ende ${this._getSortIndicator('endTime')}
                </th>
                <th @click=${() => this._handleSort('speed')}>
                  Geschwindigkeit ${this._getSortIndicator('speed')}
                </th>
                <th @click=${() => this._handleSort('status')}>
                  Status ${this._getSortIndicator('status')}
                </th>
              </tr>
            </thead>
            <tbody>
              ${this.filteredTransfers.map(transfer => html`
                <tr @click=${() => this._navigateToTransferDetail(transfer.id)}>
                  <td>${transfer.filename}</td>
                  <td>${this._formatFileSize(transfer.size)}</td>
                  <td>${this._getJobName(transfer.jobId)}</td>
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
          
          <!-- Für große Datenmengen könnte hier eine Paginierung hinzugefügt werden -->
          <!-- <div class="pagination">
            <button class="pagination-button" disabled>&laquo;</button>
            <button class="pagination-button active">1</button>
            <button class="pagination-button">2</button>
            <button class="pagination-button">3</button>
            <button class="pagination-button">&raquo;</button>
          </div> -->
        `}
      </div>
    `;
  }

  _getJobName(jobId: string): string {
    const job = this.jobs.find(j => j.id === jobId);
    return job ? job.name : jobId;
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

  _formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _formatSpeed(bytesPerSecond: number): string {
    return this._formatFileSize(bytesPerSecond) + '/s';
  }

  _formatStatus(status: string): string {
    switch (status) {
      case 'completed': return 'Erfolgreich';
      case 'failed': return 'Fehlgeschlagen';
      case 'running': return 'Wird ausgeführt';
      case 'pending': return 'Ausstehend';
      default: return status;
    }
  }

  _handleSearchInput(e: Event) {
    this.searchQuery = (e.target as HTMLInputElement).value;
    this._applyFilters();
  }

  _handleStatusFilterChange(e: Event) {
    this.statusFilter = (e.target as HTMLSelectElement).value;
    this._applyFilters();
  }

  _handleJobFilterChange(e: Event) {
    this.jobFilter = (e.target as HTMLSelectElement).value;
    this._applyFilters();
  }

  _handleTimeFilterChange(e: Event) {
    this.timeFilter = (e.target as HTMLSelectElement).value;
    this._applyFilters();
  }

  _handleSort(field: string) {
    if (this.sortField === field) {
      // Wenn das gleiche Feld erneut angeklickt wird, wechsle die Sortierrichtung
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Wenn ein neues Feld angeklickt wird, setze Feld und Standardrichtung
      this.sortField = field;
      this.sortDirection = 'desc'; // Standardmäßig absteigend sortieren
    }
    
    this._applyFilters();
  }

  _getSortIndicator(field: string): string {
    if (this.sortField !== field) return '';
    return this.sortDirection === 'asc' ? '↑' : '↓';
  }

  _navigateToTransferDetail(id: string) {
    window.location.href = `/transfers/${id}`;
  }
} 