// Kommentiere diese Importe zunächst aus
// import './components/shared/header';
// import './components/dashboard/dashboard';
// usw.

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoUser, getDemoTransfers, getDemoJobs, getDemoAgents, getDemoTokens } from './demo-mode';

// Komponenten importieren
import './components/shared/header';
import './components/jobs/job-list';
import './components/jobs/job-detail';
import './components/agents/agent-list';
import './components/agents/agent-detail';
import './components/tokens/token-list';
import './components/transfers/transfer-list';
import './components/transfers/transfer-detail';

@customElement('file-flux-app')
export class FileFluxApp extends LitElement {
  @state() private isAuthenticated = false;
  @state() private user = null;
  @state() private currentRoute = 'dashboard';
  @state() private detailId = null;
  @state() private activeTransfers = [];
  @state() private recentTransfers = [];
  @state() private stats = {
    totalTransfers: 0,
    completedTransfers: 0,
    failedTransfers: 0,
    activeAgents: 0,
    totalJobs: 0
  };

  constructor() {
    super();
    this._checkAuthAndLoadData();
    this._handleInitialRoute();

    // Event-Listener für Navigation
    window.addEventListener('popstate', () => this._handlePopState());
  }

  _handleInitialRoute() {
    const path = window.location.pathname;
    if (path === '/' || path === '/dashboard') {
      this.currentRoute = 'dashboard';
    } else if (path.startsWith('/jobs')) {
      if (path.includes('/detail/')) {
        this.currentRoute = 'job-detail';
        this.detailId = path.split('/').pop();
      } else {
        this.currentRoute = 'jobs';
      }
    } else if (path.startsWith('/agents')) {
      if (path.includes('/detail/')) {
        this.currentRoute = 'agent-detail';
        this.detailId = path.split('/').pop();
      } else {
        this.currentRoute = 'agents';
      }
    } else if (path.startsWith('/tokens')) {
      this.currentRoute = 'tokens';
    } else if (path.startsWith('/transfers')) {
      if (path.includes('/detail/')) {
        this.currentRoute = 'transfer-detail';
        this.detailId = path.split('/').pop();
      } else {
        this.currentRoute = 'transfers';
      }
    }
  }

  _handlePopState() {
    this._handleInitialRoute();
  }

  _checkAuthAndLoadData() {
    if (isDemoMode()) {
      // Im Demo-Modus automatisch authentifizieren
      this.isAuthenticated = true;
      this.user = getDemoUser();
      this._loadDemoData();
    }
  }

  _loadDemoData() {
    const transfers = getDemoTransfers();
    
    // Aktive Transfers filtern
    this.activeTransfers = transfers.filter(t => 
      t.status === 'running' || t.status === 'pending'
    );
    
    // Kürzlich abgeschlossene Transfers
    this.recentTransfers = transfers
      .filter(t => t.status === 'completed' || t.status === 'failed')
      .slice(0, 5);
    
    // Statistiken berechnen
    this.stats = {
      totalTransfers: transfers.length,
      completedTransfers: transfers.filter(t => t.status === 'completed').length,
      failedTransfers: transfers.filter(t => t.status === 'failed').length,
      activeAgents: getDemoAgents().filter(a => a.status === 'online').length,
      totalJobs: getDemoJobs().length
    };
  }

  static styles = css`
    :host {
      display: block;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      color: #333;
      background-color: #f8f9fa;
      min-height: 100vh;
    }
    
    .app-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px 20px;
    }
    
    h1, h2, h3 {
      color: #122e53;
    }
    
    .dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    
    .stat-card {
      background: white;
      border-radius: 8px;
      padding: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .stat-value {
      font-size: 32px;
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .stat-label {
      color: #666;
    }
    
    .section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    
    .transfer-item {
      padding: 15px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
    }
    
    .transfer-item:hover {
      background-color: #f9f9f9;
    }
    
    .transfer-item:last-child {
      border-bottom: none;
    }
    
    .transfer-name {
      font-weight: bold;
      margin-bottom: 5px;
    }
    
    .transfer-details {
      color: #666;
      font-size: 14px;
    }
    
    .status {
      display: inline-block;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }
    
    .status-completed {
      background-color: #e8f5e9;
      color: #2e7d32;
    }
    
    .status-failed {
      background-color: #ffebee;
      color: #c62828;
    }
    
    .status-running {
      background-color: #e3f2fd;
      color: #1565c0;
    }
    
    .user-info {
      text-align: right;
      margin-bottom: 20px;
    }
    
    .demo-badge {
      display: inline-block;
      background-color: #ff9800;
      color: white;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 12px;
      margin-left: 10px;
    }
    
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 15px;
    }
    
    .action-button {
      background-color: #122e53;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 8px 16px;
      font-weight: 500;
      cursor: pointer;
    }
    
    .action-button:hover {
      background-color: #0d2240;
    }
  `;

  _formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _formatDate(dateStr) {
    return new Date(dateStr).toLocaleString('de-DE');
  }

  _handleNavigation(e) {
    if (e.detail && e.detail.route) {
      this.currentRoute = e.detail.route;
      this.detailId = e.detail.id || null;
      
      // Update URL without page reload
      const newPath = e.detail.id ? 
        `/${e.detail.route}/detail/${e.detail.id}` : 
        `/${e.detail.route}`;
      
      window.history.pushState({}, '', newPath);
    }
  }

  _viewTransferDetails(id) {
    this.currentRoute = 'transfer-detail';
    this.detailId = id;
    window.history.pushState({}, '', `/transfers/detail/${id}`);
  }

  render() {
    if (!this.isAuthenticated) {
      return html`
        <div class="section">
          <h2>Anmeldung erforderlich</h2>
          <p>Bitte melden Sie sich an, um auf File Flux zuzugreifen.</p>
          <p>Für den Demo-Modus, fügen Sie <code>?demo=true</code> zur URL hinzu.</p>
        </div>
      `;
    }

    return html`
      <ff-header 
        .currentRoute=${this.currentRoute}
        @navigate=${this._handleNavigation}
      ></ff-header>
      
      <div class="app-container">
        ${this._renderCurrentView()}
      </div>
    `;
  }

  _renderCurrentView() {
    switch (this.currentRoute) {
      case 'dashboard':
        return this._renderDashboard();
      case 'jobs':
        return html`<ff-job-list @navigate=${this._handleNavigation}></ff-job-list>`;
      case 'job-detail':
        return html`<ff-job-detail .jobId=${this.detailId} @navigate=${this._handleNavigation}></ff-job-detail>`;
      case 'agents':
        return html`<ff-agent-list @navigate=${this._handleNavigation}></ff-agent-list>`;
      case 'agent-detail':
        return html`<ff-agent-detail .agentId=${this.detailId} @navigate=${this._handleNavigation}></ff-agent-detail>`;
      case 'tokens':
        return html`<ff-token-list @navigate=${this._handleNavigation}></ff-token-list>`;
      case 'transfers':
        return html`<ff-transfer-list @navigate=${this._handleNavigation}></ff-transfer-list>`;
      case 'transfer-detail':
        return html`<ff-transfer-detail .transferId=${this.detailId} @navigate=${this._handleNavigation}></ff-transfer-detail>`;
      default:
        return this._renderDashboard();
    }
  }

  _renderDashboard() {
    return html`
      <h1>File Flux Dashboard</h1>
      
      <div class="dashboard">
        <div class="stat-card">
          <div class="stat-value">${this.stats.totalTransfers}</div>
          <div class="stat-label">Transfers gesamt</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${this.stats.completedTransfers}</div>
          <div class="stat-label">Erfolgreiche Transfers</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${this.stats.failedTransfers}</div>
          <div class="stat-label">Fehlgeschlagene Transfers</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${this.stats.activeAgents}</div>
          <div class="stat-label">Aktive Agenten</div>
        </div>
        
        <div class="stat-card">
          <div class="stat-value">${this.stats.totalJobs}</div>
          <div class="stat-label">Eingerichtete Jobs</div>
        </div>
      </div>
      
      <div class="section">
        <div class="section-header">
          <h2>Aktive Transfers</h2>
          <button class="action-button" @click=${() => this._handleNavigation({detail: {route: 'transfers'}})}>
            Alle anzeigen
          </button>
        </div>
        
        ${this.activeTransfers.length === 0 
          ? html`<p>Keine aktiven Transfers</p>` 
          : this.activeTransfers.map(transfer => html`
            <div class="transfer-item" @click=${() => this._viewTransferDetails(transfer.id)}>
              <div class="transfer-name">${transfer.filename}</div>
              <div class="transfer-details">
                <span class="status status-${transfer.status}">${transfer.status}</span>
                Größe: ${this._formatSize(transfer.size)} | 
                Fortschritt: ${transfer.progress}% |
                Start: ${this._formatDate(transfer.startTime)}
              </div>
            </div>
          `)}
      </div>
      
      <div class="section">
        <div class="section-header">
          <h2>Kürzlich abgeschlossene Transfers</h2>
          <button class="action-button" @click=${() => this._handleNavigation({detail: {route: 'transfers'}})}>
            Alle anzeigen
          </button>
        </div>
        
        ${this.recentTransfers.length === 0 
          ? html`<p>Keine kürzlich abgeschlossenen Transfers</p>` 
          : this.recentTransfers.map(transfer => html`
            <div class="transfer-item" @click=${() => this._viewTransferDetails(transfer.id)}>
              <div class="transfer-name">${transfer.filename}</div>
              <div class="transfer-details">
                <span class="status status-${transfer.status}">${transfer.status === 'completed' ? 'completed' : 'failed'}</span>
                Größe: ${this._formatSize(transfer.size)} | 
                Start: ${this._formatDate(transfer.startTime)} |
                ${transfer.endTime ? `Ende: ${this._formatDate(transfer.endTime)}` : ''}
              </div>
            </div>
          `)}
      </div>
    `;
  }
} 