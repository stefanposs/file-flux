import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { 
  isDemoMode,
  getDemoJobs,
  getDemoTransfers,
  getDemoAgents,
  getDemoTokens,
  getTransferStats
} from '../../demo-mode';
import { api } from '../../services/api-service';

interface DashboardStats {
  activeJobs: number;
  completedTransfers: number;
  failedTransfers: number;
  onlineAgents: number;
  totalAgents: number;
  transferVolume: number;
  recentTransfers: any[];
  pendingTransfers: any[];
}

@customElement('ff-dashboard')
export class Dashboard extends LitElement {
  @state() private isLoading = true;
  @state() private error: string | null = null;
  @state() private stats: DashboardStats = {
    activeJobs: 0,
    completedTransfers: 0,
    failedTransfers: 0,
    onlineAgents: 0,
    totalAgents: 0,
    transferVolume: 0,
    recentTransfers: [],
    pendingTransfers: []
  };
  @state() private detailedStats = null;
  @state() private _activeJobs: any[] = [];

  static styles = css`
    :host {
      display: block;
    }
    
    .dashboard-container {
      padding: 20px;
    }
    
    .dashboard-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    .dashboard-title {
      font-size: 24px;
      color: #122e53;
      margin: 0;
    }
    
    .dashboard-actions {
      display: flex;
      gap: 8px;
    }
    
    .refresh-button {
      padding: 8px 16px;
      background-color: white;
      border: 1px solid #dee2e6;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    
    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 300px;
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
    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: 500;
      color: #122e53;
      margin: 10px 0;
    }
    
    .stat-label {
      font-size: 14px;
      color: #6c757d;
    }
    
    .stat-icon {
      font-size: 24px;
      margin-bottom: 10px;
    }
    
    .section-title {
      font-size: 18px;
      color: #122e53;
      margin: 30px 0 15px 0;
    }
    
    .transfers-container {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      overflow: hidden;
    }
    
    .transfers-table {
      width: 100%;
      border-collapse: collapse;
    }
    
    .transfers-table th,
    .transfers-table td {
      padding: 12px 15px;
      text-align: left;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .transfers-table th {
      background-color: #f8f9fa;
      color: #495057;
      font-weight: 500;
    }
    
    .transfers-table tr:last-child td {
      border-bottom: none;
    }
    
    .transfers-table tr:hover {
      background-color: #f8f9fa;
      cursor: pointer;
    }
    
    .status-badge {
      display: inline-block;
      padding: 3px 8px;
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
      background-color: rgba(0, 123, 255, 0.1);
      color: #007bff;
    }
    
    .status-pending {
      background-color: rgba(217, 119, 6, 0.1);
      color: #92400e;
    }
    
    .error-container {
      background-color: rgba(220, 53, 69, 0.1);
      color: #dc3545;
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .view-all-link {
      display: block;
      text-align: right;
      padding: 10px 16px;
      color: #122e53;
      text-decoration: underline;
      cursor: pointer;
      border-top: 1px solid #f0f0f0;
    }
    
    .empty-message {
      padding: 24px;
      text-align: center;
      color: #6c757d;
    }
    
    .job-status-section {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .job-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid #f0f0f0;
      cursor: pointer;
    }
    
    .job-card:last-child {
      border-bottom: none;
    }
    
    .job-card:hover {
      background-color: #f8f9fa;
    }
    
    .job-name {
      font-weight: 500;
      color: #212529;
    }
    
    .job-status {
      font-size: 14px;
      color: #6c757d;
    }
    
    .job-next-run {
      font-size: 14px;
      color: #6c757d;
    }
    
    .detailed-stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    
    .detailed-stats-card {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      padding: 20px;
    }
    
    .detailed-stats-title {
      font-size: 16px;
      font-weight: 600;
      color: #122e53;
      margin: 0 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e9ecef;
    }
    
    .detailed-stats-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid #f0f0f0;
    }
    
    .detailed-stats-item:last-child {
      border-bottom: none;
    }
    
    .detailed-stats-label {
      font-size: 14px;
      color: #6c757d;
    }
    
    .detailed-stats-value {
      font-size: 14px;
      font-weight: 600;
      color: #122e53;
    }
    
    @media (max-width: 768px) {
      .stats-grid {
        grid-template-columns: 1fr 1fr;
      }
      
      .transfers-table th:nth-child(3),
      .transfers-table td:nth-child(3) {
        display: none;
      }
    }
    
    @media (max-width: 576px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
  }

  async _loadData() {
    try {
      this.isLoading = true;
      this.error = null;

      // Try real API first
      if (api.isAuthenticated()) {
        try {
          const [jobs, transfers, agents] = await Promise.all([
            api.getJobs(),
            api.getTransfers(),
            api.getAgents(),
          ]);

          const activeJobs = jobs.filter((j: any) => j.status === 'active').length;
          const completedTransfers = transfers.filter((t: any) => t.status === 'completed').length;
          const failedTransfers = transfers.filter((t: any) => t.status === 'failed').length;
          const pendingTransfers = transfers.filter((t: any) => t.status === 'pending' || t.status === 'running');
          const onlineAgents = agents.filter((a: any) => a.status === 'online').length;

          const transferVolume = transfers
            .filter((t: any) => t.status === 'completed')
            .reduce((total: number, t: any) => total + (t.size || 0), 0);

          const recentTransfers = [...transfers]
            .filter((t: any) => t.status === 'completed' || t.status === 'failed')
            .sort((a: any, b: any) => new Date(b.start_time || b.startTime).getTime() - new Date(a.start_time || a.startTime).getTime())
            .slice(0, 5);

          this.stats = {
            activeJobs,
            completedTransfers,
            failedTransfers,
            onlineAgents,
            totalAgents: agents.length,
            transferVolume,
            recentTransfers,
            pendingTransfers
          };
          this._activeJobs = jobs.filter((j: any) => j.status === 'active');
          return;
        } catch (apiErr) {
          console.warn('API load failed, falling back to demo', apiErr);
        }
      }

      // Fall back to demo mode
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 800));

        const jobs = getDemoJobs();
        this._activeJobs = jobs.filter(job => job.status === 'active');
        const transfers = getDemoTransfers();
        const agents = getDemoAgents();
        
        const activeJobs = jobs.filter(job => job.status === 'active').length;
        const completedTransfers = transfers.filter(t => t.status === 'completed').length;
        const failedTransfers = transfers.filter(t => t.status === 'failed').length;
        const pendingTransfers = transfers.filter(t => t.status === 'pending' || t.status === 'running');
        const onlineAgents = agents.filter(a => a.status === 'online').length;
        
        const transferVolume = transfers
          .filter(t => t.status === 'completed')
          .reduce((total, t) => total + t.size, 0);
        
        const recentTransfers = [...transfers]
          .filter(t => t.status === 'completed' || t.status === 'failed')
          .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())
          .slice(0, 5);
        
        this.stats = {
          activeJobs,
          completedTransfers,
          failedTransfers,
          onlineAgents,
          totalAgents: agents.length,
          transferVolume,
          recentTransfers,
          pendingTransfers
        };

        this.detailedStats = getTransferStats();
      } else {
        this.error = 'Bitte melden Sie sich an.';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden der Dashboard-Daten: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading dashboard data:', err);
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
          <p>${this.error}</p>
          <button @click=${this._loadData}>Erneut versuchen</button>
        </div>
      `;
    }

    return html`
      <div class="dashboard-container">
        <div class="dashboard-header">
          <h1 class="dashboard-title">Dashboard</h1>
          <div class="dashboard-actions">
            <button class="refresh-button" @click=${this._refreshData}>
              🔄 Aktualisieren
            </button>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">📋</div>
            <div class="stat-value">${this.stats.activeJobs}</div>
            <div class="stat-label">Aktive Jobs</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div class="stat-value">${this.stats.completedTransfers}</div>
            <div class="stat-label">Abgeschlossene Transfers</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">❌</div>
            <div class="stat-value">${this.stats.failedTransfers}</div>
            <div class="stat-label">Fehlgeschlagene Transfers</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">🖥️</div>
            <div class="stat-value">${this.stats.onlineAgents} / ${this.stats.totalAgents}</div>
            <div class="stat-label">Online Agents</div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon">📊</div>
            <div class="stat-value">${this._formatFileSize(this.stats.transferVolume)}</div>
            <div class="stat-label">Übertragenes Volumen</div>
          </div>
        </div>
        
        <h2 class="section-title">Letzte Transfers</h2>
        <div class="transfers-container">
          ${this.stats.recentTransfers.length === 0 ? html`
            <div class="empty-message">Keine Transfers vorhanden.</div>
          ` : html`
            <table class="transfers-table">
              <thead>
                <tr>
                  <th>Datei</th>
                  <th>Größe</th>
                  <th>Startzeit</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                ${this.stats.recentTransfers.map(transfer => html`
                  <tr @click=${() => this._navigateToTransfer(transfer.id)}>
                    <td>${transfer.filename}</td>
                    <td>${this._formatFileSize(transfer.size)}</td>
                    <td>${this._formatDateTime(transfer.startTime)}</td>
                    <td>
                      <span class="status-badge status-${transfer.status}">
                        ${this._formatStatus(transfer.status)}
                      </span>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
            <div class="view-all-link" @click=${this._navigateToTransfers}>
              Alle Transfers anzeigen →
            </div>
          `}
        </div>
        
        <h2 class="section-title">Aktive Jobs</h2>
        <div class="job-status-section">
          ${this._activeJobs.length === 0 ? html`
            <div class="empty-message">Keine aktiven Jobs vorhanden.</div>
          ` : html`
            ${this._activeJobs.map(job => html`
              <div class="job-card" @click=${() => this._navigateToJob(job.id)}>
                <div>
                  <div class="job-name">${job.name}</div>
                  <div class="job-status">
                    ${job.type === 'push' ? 'Upload' : 'Download'} • 
                    ${job.lastRun ? `Zuletzt ausgeführt: ${this._formatDateTime(job.lastRun)}` : 'Noch nie ausgeführt'}
                  </div>
                </div>
                <div class="job-next-run">
                  ${job.nextRun ? `Nächste Ausführung: ${this._formatDateTime(job.nextRun)}` : 'Keine geplante Ausführung'}
                </div>
              </div>
            `)}
            <div class="view-all-link" @click=${this._navigateToJobs}>
              Alle Jobs anzeigen →
            </div>
          `}
        </div>
        
        ${this.detailedStats ? html`
          <h2 class="section-title">Detaillierte Statistiken</h2>
          <div class="detailed-stats">
            <div class="detailed-stats-card">
              <h3 class="detailed-stats-title">Transfer-Übersicht</h3>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Transfers heute</span>
                <span class="detailed-stats-value">${this.detailedStats.totalToday}</span>
              </div>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Transfers diese Woche</span>
                <span class="detailed-stats-value">${this.detailedStats.totalThisWeek}</span>
              </div>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Transfers diesen Monat</span>
                <span class="detailed-stats-value">${this.detailedStats.totalThisMonth}</span>
              </div>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Erfolgsrate</span>
                <span class="detailed-stats-value">${this.detailedStats.successRate}%</span>
              </div>
            </div>
            
            <div class="detailed-stats-card">
              <h3 class="detailed-stats-title">Performance-Übersicht</h3>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Gesamt übertragen</span>
                <span class="detailed-stats-value">${this.detailedStats.totalDataTransferred}</span>
              </div>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Durchschnittsgeschwindigkeit</span>
                <span class="detailed-stats-value">${this.detailedStats.averageTransferSpeed}</span>
              </div>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Maximale Geschwindigkeit</span>
                <span class="detailed-stats-value">${this.detailedStats.peakTransferSpeed}</span>
              </div>
              <div class="detailed-stats-item">
                <span class="detailed-stats-label">Ausstehende Transfers</span>
                <span class="detailed-stats-value">${this.detailedStats.pendingTransfers}</span>
              </div>
            </div>
          </div>
        ` : ''}
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

  _navigateToTransfers() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: '/transfers' },
      bubbles: true,
      composed: true
    }));
  }

  _navigateToTransfer(id: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/transfers/${id}` },
      bubbles: true,
      composed: true
    }));
  }

  _navigateToJobs() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: '/jobs' },
      bubbles: true,
      composed: true
    }));
  }

  _navigateToJob(id: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/jobs/${id}` },
      bubbles: true,
      composed: true
    }));
  }

  _refreshData() {
    this._loadData();
  }
} 