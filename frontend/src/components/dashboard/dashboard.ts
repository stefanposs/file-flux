import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { 
  isDemoMode,
  getDemoJobs,
  getDemoTransfers,
  getDemoAgents,
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
      color: var(--ff-gray-900, #111827);
      margin: 0;
      font-weight: 700;
    }
    
    .dashboard-actions {
      display: flex;
      gap: 8px;
    }
    
    .refresh-button {
      padding: 8px 16px;
      background-color: white;
      border: 1px solid var(--ff-gray-200, #e5e7eb);
      border-radius: var(--ff-radius-sm, 6px);
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      color: var(--ff-gray-700, #374151);
      display: flex;
      align-items: center;
      gap: 6px;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    .refresh-button:hover {
      border-color: var(--ff-gray-300, #d1d5db);
      box-shadow: var(--ff-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
    }
    

    
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background-color: white;
      border-radius: var(--ff-radius-md, 8px);
      box-shadow: var(--ff-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      padding: 24px;
      display: flex;
      align-items: flex-start;
      gap: 16px;
      border: 1px solid var(--ff-gray-200, #e5e7eb);
      border-left: 4px solid var(--ff-primary, #4f46e5);
      transition: box-shadow 0.2s, transform 0.15s;
    }

    .stat-card:hover {
      box-shadow: var(--ff-shadow-md, 0 4px 6px rgba(0,0,0,0.1));
      transform: translateY(-1px);
    }

    .stat-card:nth-child(2) { border-left-color: var(--ff-success, #10b981); }
    .stat-card:nth-child(3) { border-left-color: var(--ff-error, #ef4444); }
    .stat-card:nth-child(4) { border-left-color: var(--ff-info, #3b82f6); }
    .stat-card:nth-child(5) { border-left-color: var(--ff-secondary, #06b6d4); }
    
    .stat-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--ff-gray-900, #111827);
      margin: 0 0 2px 0;
      line-height: 1.1;
    }
    
    .stat-label {
      font-size: 13px;
      color: var(--ff-gray-500, #6b7280);
      font-weight: 500;
    }
    
    .stat-icon {
      width: 40px;
      height: 40px;
      border-radius: var(--ff-radius-md, 8px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
      font-weight: 700;
      flex-shrink: 0;
      background-color: var(--ff-primary-light, #eef2ff);
      color: var(--ff-primary, #4f46e5);
    }
    
    .section-title {
      font-size: 17px;
      color: var(--ff-gray-900, #111827);
      margin: 30px 0 15px 0;
      font-weight: 600;
    }
    
    .transfers-container {
      background-color: white;
      border-radius: var(--ff-radius-md, 8px);
      box-shadow: var(--ff-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      border: 1px solid var(--ff-gray-200, #e5e7eb);
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
      border-bottom: 1px solid var(--ff-gray-100);
    }
    
    .transfers-table th {
      background-color: var(--ff-gray-50, #f9fafb);
      color: var(--ff-gray-600, #4b5563);
      font-weight: 600;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .transfers-table tr:last-child td {
      border-bottom: none;
    }
    
    .transfers-table tr:hover {
      background-color: var(--ff-gray-50);
      cursor: pointer;
    }
    
    .error-container {
      background-color: var(--ff-error-light);
      color: var(--ff-error);
      padding: 20px;
      border-radius: 8px;
      text-align: center;
    }
    
    .view-all-link {
      display: block;
      text-align: right;
      padding: 12px 16px;
      color: var(--ff-primary, #4f46e5);
      text-decoration: none;
      cursor: pointer;
      border-top: 1px solid var(--ff-gray-100, #f3f4f6);
      font-size: 14px;
      font-weight: 500;
    }

    .view-all-link:hover {
      background: var(--ff-gray-50, #f9fafb);
    }
    
    .job-status-section {
      background-color: white;
      border-radius: var(--ff-radius-md, 8px);
      box-shadow: var(--ff-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      border: 1px solid var(--ff-gray-200, #e5e7eb);
      padding: 20px;
      margin-bottom: 30px;
    }
    
    .job-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      border-bottom: 1px solid var(--ff-gray-100);
      cursor: pointer;
    }
    
    .job-card:last-child {
      border-bottom: none;
    }
    
    .job-card:hover {
      background-color: var(--ff-gray-50);
    }
    
    .job-name {
      font-weight: 500;
      color: var(--ff-gray-900);
    }
    
    .job-status {
      font-size: 14px;
      color: var(--ff-gray-500);
    }
    
    .job-next-run {
      font-size: 14px;
      color: var(--ff-gray-500);
    }
    
    .detailed-stats {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
      gap: 20px;
    }
    
    .detailed-stats-card {
      background-color: white;
      border-radius: var(--ff-radius-md, 8px);
      box-shadow: var(--ff-shadow-sm, 0 1px 2px rgba(0,0,0,0.05));
      border: 1px solid var(--ff-gray-200, #e5e7eb);
      padding: 20px;
    }
    
    .detailed-stats-title {
      font-size: 15px;
      font-weight: 600;
      color: var(--ff-gray-900, #111827);
      margin: 0 0 16px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid var(--ff-gray-200, #e5e7eb);
    }
    
    .detailed-stats-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid var(--ff-gray-100);
    }
    
    .detailed-stats-item:last-child {
      border-bottom: none;
    }
    
    .detailed-stats-label {
      font-size: 14px;
      color: var(--ff-gray-500);
    }
    
    .detailed-stats-value {
      font-size: 14px;
      font-weight: 600;
      color: var(--ff-gray-900, #111827);
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
          const pendingTransfers = transfers
            .filter((t: any) => t.status === 'pending' || t.status === 'running')
            .map((t: any) => ({
              id: t.id,
              filename: t.filename,
              size: t.size || 0,
              status: t.status,
              progress: t.progress || 0,
              startTime: t.start_time || t.startTime,
            }));
          const onlineAgents = agents.filter((a: any) => a.status === 'online').length;

          const transferVolume = transfers
            .filter((t: any) => t.status === 'completed')
            .reduce((total: number, t: any) => total + (t.size || 0), 0);

          const recentTransfers = [...transfers]
            .filter((t: any) => t.status === 'completed' || t.status === 'failed')
            .sort((a: any, b: any) => new Date(b.start_time || b.startTime).getTime() - new Date(a.start_time || a.startTime).getTime())
            .slice(0, 5)
            .map((t: any) => ({
              id: t.id,
              filename: t.filename,
              size: t.size || 0,
              status: t.status,
              startTime: t.start_time || t.startTime,
            }));

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
          this._activeJobs = jobs.filter((j: any) => j.status === 'active').map((j: any) => ({
            id: j.id,
            name: j.name,
            type: j.type,
            status: j.status,
            lastRun: j.last_run || j.lastRun,
            nextRun: j.next_run || j.nextRun,
          }));

          // Detaillierte Stats aus realen Daten berechnen
          const now = new Date();
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const weekStart = new Date(todayStart);
          weekStart.setDate(weekStart.getDate() - weekStart.getDay());
          const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

          const totalToday = transfers.filter((t: any) => new Date(t.start_time || t.created_at) >= todayStart).length;
          const totalThisWeek = transfers.filter((t: any) => new Date(t.start_time || t.created_at) >= weekStart).length;
          const totalThisMonth = transfers.filter((t: any) => new Date(t.start_time || t.created_at) >= monthStart).length;
          const totalTransfers = transfers.length;
          const successRate = totalTransfers > 0 ? Math.round((completedTransfers / totalTransfers) * 100) : 0;
          const totalBytes = transfers.filter((t: any) => t.status === 'completed').reduce((s: number, t: any) => s + (t.size || 0), 0);

          const formatBytes = (b: number) => {
            if (b < 1024) return b + ' B';
            if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
            if (b < 1024 * 1024 * 1024) return (b / (1024 * 1024)).toFixed(1) + ' MB';
            return (b / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
          };

          this.detailedStats = {
            totalToday,
            totalThisWeek,
            totalThisMonth,
            successRate,
            totalDataTransferred: formatBytes(totalBytes),
            averageTransferSpeed: '–',
            peakTransferSpeed: '–',
            pendingTransfers: pendingTransfers.length,
          };

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
      return html`<ff-loading-spinner></ff-loading-spinner>`;
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
              Aktualisieren
            </button>
          </div>
        </div>
        
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-icon">J</div>
            <div>
              <div class="stat-value">${this.stats.activeJobs}</div>
              <div class="stat-label">Aktive Jobs</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ff-success-light,#ecfdf5);color:var(--ff-success,#10b981);">✓</div>
            <div>
              <div class="stat-value">${this.stats.completedTransfers}</div>
              <div class="stat-label">Abgeschlossene Transfers</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ff-error-light,#fef2f2);color:var(--ff-error,#ef4444);">!</div>
            <div>
              <div class="stat-value">${this.stats.failedTransfers}</div>
              <div class="stat-label">Fehlgeschlagene Transfers</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ff-info-light,#eff6ff);color:var(--ff-info,#3b82f6);">A</div>
            <div>
              <div class="stat-value">${this.stats.onlineAgents} / ${this.stats.totalAgents}</div>
              <div class="stat-label">Online Agents</div>
            </div>
          </div>
          
          <div class="stat-card">
            <div class="stat-icon" style="background:var(--ff-secondary-light);color:var(--ff-secondary);">↕</div>
            <div>
              <div class="stat-value">${this._formatFileSize(this.stats.transferVolume)}</div>
              <div class="stat-label">Übertragenes Volumen</div>
            </div>
          </div>
        </div>
        
        <h2 class="section-title">Letzte Transfers</h2>
        <div class="transfers-container">
          ${this.stats.recentTransfers.length === 0 ? html`
            <ff-empty-state icon="📊" title="Keine Transfers vorhanden"></ff-empty-state>
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
                      <ff-status-badge status="${transfer.status}"></ff-status-badge>
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
            <ff-empty-state icon="📊" title="Keine aktiven Jobs vorhanden"></ff-empty-state>
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