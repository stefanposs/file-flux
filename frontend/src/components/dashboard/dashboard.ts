import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoTransfers, getDemoAgents, getDemoJobs } from '../../demo-mode';

interface DashboardStats {
  totalTransfers: number;
  completedTransfers: number;
  failedTransfers: number;
  activeAgents: number;
  totalAgents: number;
  totalJobs: number;
  totalDataTransferred: number;
}

interface Transfer {
  id: string;
  jobId: string;
  filename: string;
  size: number;
  status: string;
  startTime: string;
  endTime?: string;
  speed: number;
  progress: number;
  source: string;
  destination: string;
  error?: string;
}

if (!customElements.get('ff-dashboard')) {
  @customElement('ff-dashboard')
  export class Dashboard extends LitElement {
    @state() private stats: DashboardStats = {
      totalTransfers: 0,
      completedTransfers: 0,
      failedTransfers: 0,
      activeAgents: 0,
      totalAgents: 0,
      totalJobs: 0,
      totalDataTransferred: 0
    };
    
    @state() private recentTransfers: Transfer[] = [];
    @state() private activeTransfers: Transfer[] = [];
    @state() private isLoading = true;
    @state() private error: string | null = null;
    @state() private refreshInterval: number | null = null;

    static styles = css`
      :host {
        display: block;
        padding: 16px;
      }
      
      .loading {
        display: flex;
        justify-content: center;
        align-items: center;
        height: 200px;
        font-size: 18px;
      }
      
      .dashboard-title {
        font-size: 24px;
        margin-bottom: 20px;
        color: #122e53;
      }
    `;

    connectedCallback() {
      super.connectedCallback();
      this.loadData();
      this.refreshInterval = window.setInterval(() => {
        const autoRefreshToggle = this.shadowRoot?.querySelector('#auto-refresh') as HTMLInputElement;
        if (autoRefreshToggle?.checked) {
          this.loadData();
        }
      }, 30000); // Aktualisiere alle 30 Sekunden, wenn Auto-Refresh aktiv ist
    }

    disconnectedCallback() {
      super.disconnectedCallback();
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }
    }

    async loadData() {
      try {
        this.isLoading = true;
        this.error = null;
        
        if (isDemoMode()) {
          // Demo-Modus: Lade simulierte Daten
          await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
          
          const demoTransfers = getDemoTransfers();
          const demoAgents = getDemoAgents();
          const demoJobs = getDemoJobs();
          
          // Aktive und kürzlich abgeschlossene Transfers filtern
          this.activeTransfers = demoTransfers.filter(t => 
            t.status === 'running' || t.status === 'pending'
          ).slice(0, 4);
          
          this.recentTransfers = demoTransfers
            .filter(t => t.status === 'completed' || t.status === 'failed')
            .sort((a, b) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime())
            .slice(0, 4);
          
          // Statistiken berechnen
          const totalDataTransferred = demoTransfers
            .filter(t => t.status === 'completed')
            .reduce((sum, t) => sum + t.size, 0);
          
          this.stats = {
            totalTransfers: demoTransfers.length,
            completedTransfers: demoTransfers.filter(t => t.status === 'completed').length,
            failedTransfers: demoTransfers.filter(t => t.status === 'failed').length,
            activeAgents: demoAgents.filter(a => a.status === 'online').length,
            totalAgents: demoAgents.length,
            totalJobs: demoJobs.length,
            totalDataTransferred
          };
        } else {
          // Echter API-Aufruf würde hier erfolgen
          // const dashboardData = await dashboardService.getStatistics();
          // const activeTransfers = await transferService.getActiveTransfers();
          // const recentTransfers = await transferService.getRecentTransfers();
          // this.stats = dashboardData;
          // this.activeTransfers = activeTransfers;
          // this.recentTransfers = recentTransfers;
          
          this.error = 'API noch nicht implementiert';
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
        return html`<div class="loading">Dashboard wird geladen...</div>`;
      }
      
      return html`
        <h1 class="dashboard-title">File Flux Dashboard</h1>
        <p>Willkommen zum File Flux Dashboard im Demo-Modus!</p>
        <p>Hier findest du einen Überblick über alle Transfers, Jobs und Agenten.</p>
      `;
    }

    _renderTransferCard(transfer: Transfer) {
      return html`
        <div class="transfer-card" @click=${() => this._navigateToTransfer(transfer.id)}>
          <div class="transfer-header">
            <div class="transfer-filename">${transfer.filename}</div>
            <div class="transfer-size">${this._formatFileSize(transfer.size)}</div>
          </div>
          <div class="transfer-body">
            <div class="transfer-details">
              <div class="transfer-status">
                <span class="status-badge status-${transfer.status}">
                  ${this._formatStatus(transfer.status)}
                </span>
                ${transfer.status === 'running' ? html`
                  <span>${Math.round(transfer.progress)}%</span>
                ` : ''}
              </div>
              ${transfer.status === 'running' ? html`
                <div>${this._formatSpeed(transfer.speed)}</div>
              ` : ''}
            </div>
            
            ${transfer.status === 'running' ? html`
              <div class="transfer-progress-container">
                <div class="transfer-progress" style="width: ${transfer.progress}%"></div>
              </div>
            ` : ''}
            
            <div class="transfer-endpoints">
              <div class="transfer-endpoint">
                <span>📤</span>
                <span>${this._formatEndpoint(transfer.source)}</span>
              </div>
              <span class="transfer-endpoint-arrow">→</span>
              <div class="transfer-endpoint">
                <span>📥</span>
                <span>${this._formatEndpoint(transfer.destination)}</span>
              </div>
            </div>
            
            <div class="transfer-time">
              <div>Start: ${this._formatTime(transfer.startTime)}</div>
              ${transfer.endTime ? html`
                <div>Ende: ${this._formatTime(transfer.endTime)}</div>
              ` : ''}
            </div>
            
            ${transfer.error ? html`
              <div class="error-message">${transfer.error}</div>
            ` : ''}
          </div>
        </div>
      `;
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

    _formatEndpoint(endpoint: string): string {
      // Einfache Kürzung für lange Endpunkte
      if (endpoint.length > 25) {
        return endpoint.substring(0, 22) + '...';
      }
      return endpoint;
    }

    _formatTime(timeStr: string): string {
      const date = new Date(timeStr);
      return date.toLocaleTimeString('de-DE', {
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    _navigateToTransfer(transferId: string) {
      window.location.href = `/transfers/${transferId}`;
    }
  }
} 