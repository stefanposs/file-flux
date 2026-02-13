// Kommentiere diese Importe zunächst aus
// import './components/shared/header';
// import './components/dashboard/dashboard';
// usw.

import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoUser, getDemoTransfers, getDemoJobs, getDemoAgents, getDemoTokens, initDemoMode } from './demo-mode';

// Komponenten importieren
import './components/shared/header';
import './components/shared/toast';
import './components/dashboard/dashboard';
import './components/jobs/job-list';
import './components/jobs/job-detail';
import './components/agents/agent-list';
import './components/agents/agent-detail';
import './components/tokens/token-list';
import './components/transfers/transfer-list';
import './components/transfers/transfer-detail';

// Typendefinitionen für bessere Typsicherheit
interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar: string | null;
  lastLogin?: string;
}

interface RouteParams {
  id?: string;
  [key: string]: string | undefined;
}

interface AppStats {
  totalTransfers: number;
  completedTransfers: number;
  failedTransfers: number;
  activeAgents: number;
  totalJobs: number;
}

@customElement('file-flux-app')
export class FileFluxApp extends LitElement {
  @state() private isAuthenticated = false;
  @state() private user: User | null = null;
  @state() private currentRoute = '/';
  @state() private routeParams: RouteParams = {};
  @state() private isDemoMode = false;
  @state() private isLoading = true;
  @state() private sidebarOpen = false;
  @state() private activeTransfers: any[] = [];
  @state() private recentTransfers: any[] = [];
  @state() private stats: AppStats = {
    totalTransfers: 0,
    completedTransfers: 0,
    failedTransfers: 0,
    activeAgents: 0,
    totalJobs: 0
  };
  @state() private loginError: string | null = null;

  static styles = css`
    :host {
      display: block;
      font-family: 'Roboto', 'Helvetica Neue', sans-serif;
      color: #333;
      --primary-color: #122e53;
      --secondary-color: #ffb951;
      --error-color: #d9534f;
      --success-color: #5cb85c;
      --warning-color: #f0ad4e;
      --light-bg: #f8f9fa;
      --border-color: #e9ecef;
      height: 100vh;
    }

    *, *::before, *::after {
      box-sizing: border-box;
    }

    .app-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    main {
      flex: 1;
      background-color: #f8f9fa;
      padding: 20px;
      overflow-y: auto;
    }

    .content-container {
      max-width: 1400px;
      margin: 0 auto;
    }

    .loading-container {
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100%;
    }

    .loading-spinner {
      width: 50px;
      height: 50px;
      border: 5px solid rgba(18, 46, 83, 0.1);
      border-left-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      background: linear-gradient(135deg, #122e53 0%, #1a4b8a 100%);
      color: white;
    }

    .login-box {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
      padding: 30px;
      width: 100%;
      max-width: 400px;
      color: #333;
    }

    .login-logo {
      text-align: center;
      margin-bottom: 24px;
    }

    .login-logo h1 {
      color: var(--primary-color);
      margin: 0;
    }

    .login-title {
      font-size: 24px;
      margin-bottom: 24px;
      text-align: center;
      color: var(--primary-color);
    }

    .login-form {
      display: flex;
      flex-direction: column;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-label {
      display: block;
      margin-bottom: 6px;
      font-weight: 500;
    }

    .form-input {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }

    .login-button {
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: 4px;
      padding: 12px;
      font-size: 16px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .login-button:hover {
      background-color: #0d2241;
    }

    .demo-mode-container {
      text-align: center;
      margin-top: 20px;
      padding-top: 20px;
      border-top: 1px solid #eee;
    }

    .demo-mode-button {
      background-color: var(--secondary-color);
      color: #333;
      border: none;
      border-radius: 4px;
      padding: 10px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .demo-mode-button:hover {
      background-color: #e9a93e;
    }

    .demo-mode-banner {
      background-color: var(--secondary-color);
      color: #333;
      text-align: center;
      padding: 6px;
      font-weight: 500;
    }

    .login-error {
      color: var(--error-color);
      margin-bottom: 16px;
      padding: 8px;
      background-color: rgba(217, 83, 79, 0.1);
      border-radius: 4px;
      text-align: center;
    }

    /* Mobile-Anpassungen */
    @media (max-width: 768px) {
      main {
        padding: 15px;
      }
      
      .login-box {
        width: 90%;
        padding: 20px;
      }
    }
  `;

  constructor() {
    super();
    this._handleRoute();
    
    // Überprüfe URL-Parameter für Demo-Modus
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === 'true') {
      localStorage.setItem('demoMode', 'true');
      this.isDemoMode = true;
    } else {
      this.isDemoMode = localStorage.getItem('demoMode') === 'true';
    }
    
    // Event-Listener für Browser-Navigation
    window.addEventListener('popstate', () => this._handleRoute());
    
    // Event-Listener für SPA-Navigation aus Kindkomponenten
    this.addEventListener('navigate', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      const path = detail?.path || detail?.route;
      if (path) {
        // Support both /path and route-name formats
        const normalizedPath = path.startsWith('/') ? path : `/${path}`;
        this._navigate(normalizedPath);
      }
    });
    
    // Initialisiere Demo-Modus, wenn aktiviert
    if (this.isDemoMode) {
      initDemoMode();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    this._checkAuth();
  }

  async _checkAuth() {
    this.isLoading = true;
    
    try {
      if (this.isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const user = getDemoUser();
        this.isAuthenticated = true;
        this.user = user;
        
        // Demo-Daten nur laden, wenn authentifiziert
        this._loadDemoData();
      } else {
        // API-Aufruf würde hier kommen
        this.isAuthenticated = false;
        this.user = null;
      }
    } catch (error) {
      console.error('Auth check failed', error);
      this.isAuthenticated = false;
      this.user = null;
    } finally {
      this.isLoading = false;
    }
  }

  _handleRoute() {
    const path = window.location.pathname;
    const routeParts = path.split('/').filter(Boolean);
    
    // Bestimme die aktuelle Route und Parameter
    if (routeParts.length === 0) {
      this.currentRoute = '/';
      this.routeParams = {};
    } else {
      switch (routeParts[0]) {
        case 'jobs':
          if (routeParts.length === 1) {
            this.currentRoute = '/jobs';
            this.routeParams = {};
          } else {
            this.currentRoute = '/jobs/detail';
            this.routeParams = { id: routeParts[1] };
          }
          break;
          
        case 'agents':
          if (routeParts.length === 1) {
            this.currentRoute = '/agents';
            this.routeParams = {};
          } else {
            this.currentRoute = '/agents/detail';
            this.routeParams = { id: routeParts[1] };
          }
          break;
          
        case 'tokens':
          this.currentRoute = '/tokens';
          this.routeParams = {};
          break;
          
        case 'transfers':
          if (routeParts.length === 1) {
            this.currentRoute = '/transfers';
            this.routeParams = {};
          } else {
            this.currentRoute = '/transfers/detail';
            this.routeParams = { id: routeParts[1] };
          }
          break;
          
        default:
          this.currentRoute = `/${routeParts[0]}`;
          this.routeParams = {};
      }
    }
  }

  _navigate(path: string) {
    window.history.pushState(null, '', path);
    this._handleRoute();
  }

  _toggleSidebar() {
    this.sidebarOpen = !this.sidebarOpen;
  }

  _handleLogin(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    
    if (this.isDemoMode) {
      // Im Demo-Modus Anmeldung simulieren
      this.isAuthenticated = true;
      this.user = getDemoUser();
      this._navigate('/');
    } else {
      // Hier würde normalerweise ein API-Aufruf kommen
      this.loginError = "Login ist nur im Demo-Modus verfügbar";
    }
  }

  _activateDemoMode() {
    localStorage.setItem('demoMode', 'true');
    window.location.href = '/?demo=true';
  }

  _loadDemoData() {
    const transfers = getDemoTransfers();
    
    // Aktive Transfers filtern
    this.activeTransfers = transfers.filter((t: any) => 
      t.status === 'running' || t.status === 'pending'
    );
    
    // Kürzlich abgeschlossene Transfers
    this.recentTransfers = transfers
      .filter((t: any) => t.status === 'completed' || t.status === 'failed')
      .slice(0, 5);
    
    // Statistiken berechnen
    this.stats = {
      totalTransfers: transfers.length,
      completedTransfers: transfers.filter((t: any) => t.status === 'completed').length,
      failedTransfers: transfers.filter((t: any) => t.status === 'failed').length,
      activeAgents: getDemoAgents().filter((a: any) => a.status === 'online').length,
      totalJobs: getDemoJobs().length
    };
  }

  _renderContent() {
    switch (this.currentRoute) {
      case '/':
        return html`<ff-dashboard></ff-dashboard>`;
        
      case '/jobs':
        return html`<ff-job-list></ff-job-list>`;
        
      case '/jobs/detail':
        return html`<ff-job-detail jobId="${this.routeParams.id || ''}"></ff-job-detail>`;
        
      case '/agents':
        return html`<ff-agent-list></ff-agent-list>`;
        
      case '/agents/detail':
        return html`<ff-agent-detail agentId="${this.routeParams.id || ''}"></ff-agent-detail>`;
        
      case '/tokens':
        return html`<ff-token-list></ff-token-list>`;
        
      case '/transfers':
        return html`<ff-transfer-list></ff-transfer-list>`;
        
      case '/transfers/detail':
        return html`<ff-transfer-detail transferId="${this.routeParams.id || ''}"></ff-transfer-detail>`;
        
      default:
        return html`<div>Seite nicht gefunden</div>`;
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

    if (!this.isAuthenticated) {
      return html`
        <div class="login-container">
          <div class="login-box">
            <div class="login-logo">
              <h1>File Flux</h1>
            </div>
            
            <h2 class="login-title">Anmelden</h2>
            
            ${this.loginError ? html`
              <div class="login-error">${this.loginError}</div>
            ` : ''}
            
            <form class="login-form" @submit=${this._handleLogin}>
              <div class="form-group">
                <label class="form-label" for="email">E-Mail</label>
                <input class="form-input" type="email" id="email" name="email" required>
              </div>
              
              <div class="form-group">
                <label class="form-label" for="password">Passwort</label>
                <input class="form-input" type="password" id="password" name="password" required>
              </div>
              
              <button type="submit" class="login-button">Anmelden</button>
            </form>
            
            <div class="demo-mode-container">
              <p>Oder testen Sie die Anwendung im Demo-Modus</p>
              <button class="demo-mode-button" @click=${this._activateDemoMode}>
                Demo starten
              </button>
            </div>
          </div>
        </div>
      `;
    }

    return html`
      <ff-toast-container></ff-toast-container>
      <div class="app-container">
        ${this.isDemoMode ? html`
          <div class="demo-mode-banner">
            ⚠️ Demo-Modus aktiv - Alle Daten sind Beispieldaten
          </div>
        ` : ''}
        
        <ff-header
          .sidebarOpen=${this.sidebarOpen}
          .currentRoute=${this.currentRoute}
          .user=${this.user}
          @toggle-sidebar=${this._toggleSidebar}
        ></ff-header>
        
        <main>
          <div class="content-container">
            ${this._renderContent()}
          </div>
        </main>
      </div>
    `;
  }
} 