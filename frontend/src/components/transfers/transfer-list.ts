import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers, getDemoJobs, getDemoAgents } from '../../demo-mode';

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
  @state() private dateFilter = 'all';
  @state() private sortField = 'startTime';
  @state() private sortDirection = 'desc';
  @state() private pagination = {
    page: 1,
    pageSize: 10,
    total: 0
  };

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
    
    .transfers-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
      padding: 16px;
    }
    
    .filters {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 16px;
    }
    
    .search-box {
      flex-grow: 1;
      position: relative;
      min-width: 200px;
    }
    
    .search-input {
      width: 100%;
      padding: 8px 12px 8px 36px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      font-size: 15px;
    }
    
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #6c757d;
    }
    
    .filter-select {
      padding: 8px 12px;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      min-width: 120px;
    }
    
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
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
    
    .error-container {
      padding: 24px;
      background-color: rgba(220, 53, 69, 0.05);
      color: #dc3545;
      border-radius: 8px;
      text-align: center;
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
    }
    
    th, td {
      padding: 12px 16px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }
    
    th {
      color: #495057;
      font-weight: 500;
      position: relative;
      cursor: pointer;
      user-select: none;
    }
    
    th:hover {
      background-color: #f8f9fa;
    }
    
    .sort-icon {
      margin-left: 4px;
    }
    
    .sort-icon::after {
      content: '↕️';
      font-size: 12px;
      opacity: 0.5;
    }
    
    .sort-icon.asc::after {
      content: '↑';
      opacity: 1;
    }
    
    .sort-icon.desc::after {
      content: '↓';
      opacity: 1;
    }
    
    tbody tr {
      cursor: pointer;
      transition: background-color 0.1s;
    }
    
    tbody tr:hover {
      background-color: #f8f9fa;
    }
    
    .status-badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
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
      background-color: rgba(13, 110, 253, 0.1);
      color: #0d6efd;
    }
    
    .status-pending {
      background-color: rgba(255, 193, 7, 0.1);
      color: #ffc107;
    }
    
    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }
    
    .pagination-info {
      color: #6c757d;
      font-size: 14px;
    }
    
    .pagination-controls {
      display: flex;
      gap: 8px;
    }
    
    .pagination-button {
      padding: 4px 12px;
      border: 1px solid #dee2e6;
      background-color: white;
      border-radius: 4px;
      cursor: pointer;
    }
    
    .pagination-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .pagination-button.active {
      background-color: #122e53;
      color: white;
      border-color: #122e53;
    }
    
    .empty-message {
      text-align: center;
      padding: 24px;
      color: #6c757d;
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
        // Simuliere Netzwerklatenz
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // Lade Transfers
        const transfers = getDemoTransfers();
        this.transfers = transfers;
        
        // Lade Jobs für die Filter
        this.jobs = getDemoJobs();
        
        this._applyFilters();
      } else {
        // Hier würde später der API-Aufruf kommen
        this.error = 'API noch nicht implementiert';
      }
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
      this.pagination.total = 0;
      return;
    }
    
    let filtered = [...this.transfers];
    
    // Suchfilter anwenden
    if (this.searchQuery) {
      const query = this.searchQuery.toLowerCase();
      filtered = filtered.filter(transfer => 
        transfer.filename.toLowerCase().includes(query) || 
        transfer.source.toLowerCase().includes(query) || 
        transfer.destination.toLowerCase().includes(query)
      );
    }
    
    // Statusfilter anwenden
    if (this.statusFilter !== 'all') {
      filtered = filtered.filter(transfer => transfer.status === this.statusFilter);
    }
    
    // Jobfilter anwenden
    if (this.jobFilter !== 'all') {
      filtered = filtered.filter(transfer => transfer.jobId === this.jobFilter);
    }
    
    // Datumsfilter anwenden
    if (this.dateFilter !== 'all') {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      switch (this.dateFilter) {
        case 'today':
          filtered = filtered.filter(transfer => {
            const transferDate = new Date(transfer.startTime);
            return transferDate >= today;
          });
          break;
        case 'yesterday': {
          const yesterday = new Date(today);
          yesterday.setDate(yesterday.getDate() - 1);
          filtered = filtered.filter(transfer => {
            const transferDate = new Date(transfer.startTime);
            return transferDate >= yesterday && transferDate < today;
          });
          break;
        }
        case 'week': {
          const lastWeek = new Date(today);
          lastWeek.setDate(lastWeek.getDate() - 7);
          filtered = filtered.filter(transfer => {
            const transferDate = new Date(transfer.startTime);
            return transferDate >= lastWeek;
          });
          break;
        }
        case 'month': {
          const lastMonth = new Date(today);
          lastMonth.setMonth(lastMonth.getMonth() - 1);
          filtered = filtered.filter(transfer => {
            const transferDate = new Date(transfer.startTime);
            return transferDate >= lastMonth;
          });
          break;
        }
      }
    }
    
    // Sortierung anwenden
    filtered.sort((a, b) => {
      let valueA = a[this.sortField];
      let valueB = b[this.sortField];
      
      if (typeof valueA === 'string') {
        valueA = valueA.toLowerCase();
        valueB = valueB.toLowerCase();
      }
      
      if (this.sortField === 'startTime' || this.sortField === 'endTime') {
        valueA = new Date(valueA).getTime();
        valueB = new Date(valueB).getTime();
      }
      
      if (valueA < valueB) {
        return this.sortDirection === 'asc' ? -1 : 1;
      }
      if (valueA > valueB) {
        return this.sortDirection === 'asc' ? 1 : -1;
      }
      return 0;
    });
    
    // Pagination anwenden
    this.pagination.total = filtered.length;
    const start = (this.pagination.page - 1) * this.pagination.pageSize;
    const end = start + this.pagination.pageSize;
    
    this.filteredTransfers = filtered.slice(start, end);
  }

  _handleSort(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    
    this._applyFilters();
  }

  _handleSearch(e) {
    this.searchQuery = e.target.value;
    this.pagination.page = 1;
    this._applyFilters();
  }

  _handleStatusFilter(e) {
    this.statusFilter = e.target.value;
    this.pagination.page = 1;
    this._applyFilters();
  }

  _handleJobFilter(e) {
    this.jobFilter = e.target.value;
    this.pagination.page = 1;
    this._applyFilters();
  }

  _handleDateFilter(e) {
    this.dateFilter = e.target.value;
    this.pagination.page = 1;
    this._applyFilters();
  }

  _goToPage(page) {
    if (page < 1 || page > this._getTotalPages()) {
      return;
    }
    
    this.pagination.page = page;
    this._applyFilters();
  }

  _getTotalPages() {
    return Math.ceil(this.pagination.total / this.pagination.pageSize);
  }

  _navigateToTransfer(id) {
    window.location.href = `/transfers/${id}`;
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

  _getJobName(jobId) {
    const job = this.jobs.find(j => j.id === jobId);
    return job ? job.name : jobId;
  }

  render() {
    return html`
      <div>
        <div class="header">
          <h1>Transfers</h1>
        </div>
        
        <div class="transfers-container">
          <div class="filters">
            <div class="search-box">
              <span class="search-icon">🔍</span>
              <input
                type="text"
                class="search-input"
                placeholder="Suche nach Dateiname, Quelle oder Ziel..."
                .value=${this.searchQuery}
                @input=${this._handleSearch}
              >
            </div>
            
            <select 
              class="filter-select" 
              .value=${this.statusFilter}
              @change=${this._handleStatusFilter}
            >
              <option value="all">Alle Status</option>
              <option value="completed">Abgeschlossen</option>
              <option value="failed">Fehlgeschlagen</option>
              <option value="running">Wird ausgeführt</option>
              <option value="pending">Ausstehend</option>
            </select>
            
            <select 
              class="filter-select" 
              .value=${this.jobFilter}
              @change=${this._handleJobFilter}
            >
              <option value="all">Alle Jobs</option>
              ${this.jobs.map(job => html`
                <option value=${job.id}>${job.name}</option>
              `)}
            </select>
            
            <select 
              class="filter-select" 
              .value=${this.dateFilter}
              @change=${this._handleDateFilter}
            >
              <option value="all">Alle Zeiträume</option>
              <option value="today">Heute</option>
              <option value="yesterday">Gestern</option>
              <option value="week">Letzte 7 Tage</option>
              <option value="month">Letzter Monat</option>
            </select>
          </div>
          
          ${this.isLoading ? html`
            <div class="loading-container">
              <div class="loading-spinner"></div>
            </div>
          ` : ''}
          
          ${this.error ? html`
            <div class="error-container">
              <p>${this.error}</p>
              <button @click=${this._loadData}>Erneut versuchen</button>
            </div>
          ` : ''}
          
          ${!this.isLoading && !this.error ? html`
            ${this.filteredTransfers.length === 0 ? html`
              <div class="empty-message">
                <p>Keine Transfers gefunden.</p>
              </div>
            ` : html`
              <table>
                <thead>
                  <tr>
                    <th @click=${() => this._handleSort('filename')}>
                      Datei
                      <span class="sort-icon ${this.sortField === 'filename' ? this.sortDirection : ''}"></span>
                    </th>
                    <th @click=${() => this._handleSort('size')}>
                      Größe
                      <span class="sort-icon ${this.sortField === 'size' ? this.sortDirection : ''}"></span>
                    </th>
                    <th @click=${() => this._handleSort('startTime')}>
                      Startzeit
                      <span class="sort-icon ${this.sortField === 'startTime' ? this.sortDirection : ''}"></span>
                    </th>
                    <th @click=${() => this._handleSort('endTime')}>
                      Endzeit
                      <span class="sort-icon ${this.sortField === 'endTime' ? this.sortDirection : ''}"></span>
                    </th>
                    <th>
                      Job
                    </th>
                    <th @click=${() => this._handleSort('status')}>
                      Status
                      <span class="sort-icon ${this.sortField === 'status' ? this.sortDirection : ''}"></span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  ${this.filteredTransfers.map(transfer => html`
                    <tr @click=${() => this._navigateToTransfer(transfer.id)}>
                      <td>${transfer.filename}</td>
                      <td>${this._formatFileSize(transfer.size)}</td>
                      <td>${this._formatDateTime(transfer.startTime)}</td>
                      <td>${transfer.endTime ? this._formatDateTime(transfer.endTime) : '-'}</td>
                      <td>${transfer.jobId ? this._getJobName(transfer.jobId) : '-'}</td>
                      <td>
                        <span class="status-badge status-${transfer.status}">
                          ${this._formatStatus(transfer.status)}
                        </span>
                      </td>
                    </tr>
                  `)}
                </tbody>
              </table>
              
              <div class="pagination">
                <div class="pagination-info">
                  Zeige ${(this.pagination.page - 1) * this.pagination.pageSize + 1} bis 
                  ${Math.min(this.pagination.page * this.pagination.pageSize, this.pagination.total)} 
                  von ${this.pagination.total} Einträgen
                </div>
                
                <div class="pagination-controls">
                  <button 
                    class="pagination-button" 
                    ?disabled=${this.pagination.page === 1}
                    @click=${() => this._goToPage(1)}
                  >
                    «
                  </button>
                  
                  <button 
                    class="pagination-button" 
                    ?disabled=${this.pagination.page === 1}
                    @click=${() => this._goToPage(this.pagination.page - 1)}
                  >
                    ‹
                  </button>
                  
                  ${Array.from({ length: Math.min(5, this._getTotalPages()) }, (_, i) => {
                    const pageNum = this.pagination.page <= 3 
                      ? i + 1 
                      : this.pagination.page + i - 2;
                      
                    if (pageNum <= 0 || pageNum > this._getTotalPages()) {
                      return '';
                    }
                    
                    return html`
                      <button 
                        class="pagination-button ${pageNum === this.pagination.page ? 'active' : ''}" 
                        @click=${() => this._goToPage(pageNum)}
                      >
                        ${pageNum}
                      </button>
                    `;
                  })}
                  
                  <button 
                    class="pagination-button" 
                    ?disabled=${this.pagination.page === this._getTotalPages() || this._getTotalPages() === 0}
                    @click=${() => this._goToPage(this.pagination.page + 1)}
                  >
                    ›
                  </button>
                  
                  <button 
                    class="pagination-button" 
                    ?disabled=${this.pagination.page === this._getTotalPages() || this._getTotalPages() === 0}
                    @click=${() => this._goToPage(this._getTotalPages())}
                  >
                    »
                  </button>
                </div>
              </div>
            `}
          ` : ''}
        </div>
      </div>
    `;
  }
} 