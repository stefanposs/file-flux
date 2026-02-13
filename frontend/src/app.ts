import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoUser, getDemoTransfers, getDemoJobs, getDemoAgents, getDemoTokens, initDemoMode } from './demo-mode';
import { api, ApiRequestError } from './services/api-service';
import { showToast } from './components/shared/toast';

// Komponenten importieren
import './components/shared/header';
import './components/shared/toast';
import './components/dashboard/dashboard';
import './components/jobs/job-list';
import './components/jobs/job-detail';
import './components/jobs/job-edit';
import './components/agents/agent-list';
import './components/agents/agent-detail';
import './components/agents/agent-edit';
import './components/tokens/token-list';
import './components/transfers/transfer-list';
import './components/transfers/transfer-detail';
import './components/settings/settings-page';

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
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #1e293b;
      /* Primary */
      --primary-color: #4f46e5;
      --primary-hover: #4338ca;
      --primary-light: #eef2ff;
      --primary-dark: #3730a3;
      /* Secondary */
      --secondary-color: #06b6d4;
      /* Status */
      --success-color: #10b981;
      --success-light: #ecfdf5;
      --warning-color: #f59e0b;
      --warning-light: #fffbeb;
      --error-color: #ef4444;
      --error-light: #fef2f2;
      --info-color: #3b82f6;
      --info-light: #eff6ff;
      /* Neutrals */
      --gray-50: #f9fafb;
      --gray-100: #f3f4f6;
      --gray-200: #e5e7eb;
      --gray-300: #d1d5db;
      --gray-400: #9ca3af;
      --gray-500: #6b7280;
      --gray-600: #4b5563;
      --gray-700: #374151;
      --gray-800: #1f2937;
      --gray-900: #111827;
      /* Surfaces */
      --light-bg: #f9fafb;
      --border-color: #e5e7eb;
      /* Shadows */
      --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
      --shadow-md: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -2px rgba(0,0,0,0.1);
      --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1);
      /* Radius */
      --radius-sm: 6px;
      --radius-md: 8px;
      --radius-lg: 12px;
      --radius-full: 9999px;
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
      background-color: var(--gray-50);
      padding: 24px;
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
      border: 4px solid var(--gray-200);
      border-left-color: var(--primary-color);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .login-container {
      display: grid;
      grid-template-columns: 1fr 1fr;
      height: 100%;
    }

    .login-branding {
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #312e81 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px;
      color: white;
    }

    .login-branding h1 {
      font-size: 36px;
      font-weight: 700;
      margin: 0 0 12px 0;
      letter-spacing: -0.5px;
    }

    .login-branding p {
      font-size: 17px;
      opacity: 0.85;
      line-height: 1.6;
      margin: 0;
    }

    .login-features {
      margin-top: 48px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }

    .login-feature-item {
      display: flex;
      gap: 14px;
      align-items: flex-start;
      font-size: 15px;
      opacity: 0.9;
      line-height: 1.4;
    }

    .login-feature-icon {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      background: rgba(255,255,255,0.12);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      font-size: 16px;
      font-weight: 700;
      color: #a5b4fc;
    }

    .login-form-side {
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--gray-50);
    }

    .login-box {
      background-color: white;
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-lg);
      padding: 40px;
      width: 100%;
      max-width: 420px;
      color: var(--gray-800);
    }

    .login-logo {
      text-align: center;
      margin-bottom: 32px;
    }

    .login-logo-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: var(--radius-md);
      background: var(--primary-color);
      color: white;
      font-size: 18px;
      font-weight: 700;
      letter-spacing: -0.5px;
      margin-bottom: 12px;
    }

    .login-logo h1 {
      color: var(--gray-900);
      margin: 0;
      font-size: 22px;
      font-weight: 700;
    }

    .login-title {
      font-size: 15px;
      margin-bottom: 24px;
      text-align: center;
      color: var(--gray-500);
      font-weight: 400;
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
      padding: 10px 14px;
      border: 1px solid var(--gray-300);
      border-radius: var(--radius-sm);
      font-size: 15px;
      transition: border-color 0.2s, box-shadow 0.2s;
      outline: none;
    }

    .form-input:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px var(--primary-light);
    }

    .login-button {
      background-color: var(--primary-color);
      color: white;
      border: none;
      border-radius: var(--radius-sm);
      padding: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.2s, transform 0.1s;
      width: 100%;
    }

    .login-button:hover {
      background-color: var(--primary-hover);
    }

    .login-button:active {
      transform: scale(0.98);
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
      background-color: var(--warning-light);
      color: var(--gray-800);
      text-align: center;
      padding: 8px;
      font-weight: 500;
      font-size: 14px;
      border-bottom: 1px solid var(--warning-color);
    }

    .login-error {
      color: var(--error-color);
      margin-bottom: 16px;
      padding: 10px 12px;
      background-color: var(--error-light);
      border-radius: var(--radius-sm);
      text-align: center;
      font-size: 14px;
    }

    /* Mobile-Anpassungen */
    @media (max-width: 768px) {
      main {
        padding: 16px;
      }

      .login-container {
        grid-template-columns: 1fr;
      }

      .login-branding {
        display: none;
      }

      .login-form-side {
        height: 100vh;
      }
      
      .login-box {
        width: 90%;
        padding: 24px;
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

    // Listen for auth expiration (e.g. 401 from API)
    window.addEventListener('ff-auth-expired', () => {
      this._handleLogout();
      showToast('Sitzung abgelaufen – bitte erneut anmelden', 'warning');
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('ff-auth-expired', () => {});
  }

  async _checkAuth() {
    this.isLoading = true;
    
    try {
      // 1. Try real API auth (stored token)
      if (api.isAuthenticated()) {
        const apiUser = await api.getCurrentUser();
        this.isAuthenticated = true;
        this.user = {
          id: String(apiUser.id),
          name: apiUser.name || apiUser.email,
          email: apiUser.email,
          role: apiUser.role,
          avatar: null,
        };
        return;
      }

      // 2. Fall back to demo mode
      if (this.isDemoMode) {
        await new Promise(resolve => setTimeout(resolve, 800));
        const user = getDemoUser();
        this.isAuthenticated = true;
        this.user = user;
        this._loadDemoData();
        return;
      }

      // 3. Not authenticated
      this.isAuthenticated = false;
      this.user = null;
    } catch (error) {
      console.error('Auth check failed', error);
      // Token might be expired — clear and show login
      api.logout();
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
          } else if (routeParts.length === 3 && routeParts[1] === 'edit') {
            this.currentRoute = '/jobs/edit';
            this.routeParams = { id: routeParts[2] };
          } else {
            this.currentRoute = '/jobs/detail';
            this.routeParams = { id: routeParts[1] };
          }
          break;
          
        case 'agents':
          if (routeParts.length === 1) {
            this.currentRoute = '/agents';
            this.routeParams = {};
          } else if (routeParts.length === 3 && routeParts[1] === 'edit') {
            this.currentRoute = '/agents/edit';
            this.routeParams = { id: routeParts[2] };
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

        case 'settings':
          this.currentRoute = '/settings';
          this.routeParams = {};
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

  async _handleLogin(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value;
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    this.loginError = null;
    
    // 1. Try real API login first
    try {
      const response = await api.login(email, password);
      this.isAuthenticated = true;
      this.user = {
        id: String(response.user.id),
        name: response.user.name || response.user.email,
        email: response.user.email,
        role: response.user.role,
        avatar: null,
      };
      showToast('Erfolgreich angemeldet', 'success');
      this._navigate('/');
      return;
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.status === 401) {
          this.loginError = 'Ungültige E-Mail oder Passwort';
        } else if (error.status === 429) {
          this.loginError = 'Zu viele Anmeldeversuche – bitte warten';
        } else {
          this.loginError = `Anmeldefehler: ${error.message}`;
        }
      } else {
        // Network error — backend might be unreachable
        console.warn('API login failed, trying demo mode', error);
        
        // 2. Fall back to demo mode if enabled
        if (this.isDemoMode) {
          this.isAuthenticated = true;
          this.user = getDemoUser();
          this._loadDemoData();
          this._navigate('/');
          return;
        }
        this.loginError = 'Server nicht erreichbar';
      }
    }
  }

  _handleLogout() {
    api.logout();
    this.isAuthenticated = false;
    this.user = null;
    this.activeTransfers = [];
    this.recentTransfers = [];
    this.stats = { totalTransfers: 0, completedTransfers: 0, failedTransfers: 0, activeAgents: 0, totalJobs: 0 };
    this._navigate('/');
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
        
      case '/jobs/edit':
        return html`<ff-job-edit jobId="${this.routeParams.id || ''}"></ff-job-edit>`;
        
      case '/agents':
        return html`<ff-agent-list></ff-agent-list>`;
        
      case '/agents/detail':
        return html`<ff-agent-detail agentId="${this.routeParams.id || ''}"></ff-agent-detail>`;
        
      case '/agents/edit':
        return html`<ff-agent-edit agentId="${this.routeParams.id || ''}"></ff-agent-edit>`;
        
      case '/tokens':
        return html`<ff-token-list></ff-token-list>`;
        
      case '/transfers':
        return html`<ff-transfer-list></ff-transfer-list>`;
        
      case '/transfers/detail':
        return html`<ff-transfer-detail transferId="${this.routeParams.id || ''}"></ff-transfer-detail>`;
        
      case '/settings':
        return html`<ff-settings></ff-settings>`;
        
      default:
        return html`
          <div style="text-align:center;padding:80px 20px;">
            <div style="width:64px;height:64px;border-radius:12px;background:var(--primary-light);color:var(--primary-color);display:inline-flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;margin-bottom:20px;">?</div>
            <h1 style="font-size:48px;margin:0;color:var(--gray-900);font-weight:700;">404</h1>
            <p style="font-size:16px;color:var(--gray-500);margin:12px 0 28px;line-height:1.5;">Die Seite <code style="background:var(--gray-100);padding:2px 8px;border-radius:4px;font-size:14px;">${this.currentRoute}</code> wurde nicht gefunden.</p>
            <button
              style="background:var(--primary-color);color:#fff;border:none;border-radius:var(--radius-sm);padding:10px 24px;font-size:15px;font-weight:600;cursor:pointer;transition:background 0.2s;"
              @click=${() => this._navigate('/')}
            >Zurück zum Dashboard</button>
          </div>
        `;
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
          <div class="login-branding">
            <h1>FileFlux</h1>
            <p>Sichere Dateiübertragung zwischen Servern und Clients — automatisiert, zuverlässig, überall.</p>
            <div class="login-features">
              <div class="login-feature-item">
                <div class="login-feature-icon">↔</div>
                <div><strong>Agent-basierter Transfer</strong><br>Installieren Sie Agents auf beliebigen Systemen und steuern Sie Transfers zentral.</div>
              </div>
              <div class="login-feature-item">
                <div class="login-feature-icon">⚡</div>
                <div><strong>Automatisierte Jobs</strong><br>Zeitgesteuerte Übertragungen mit Cron-ähnlicher Planung.</div>
              </div>
              <div class="login-feature-item">
                <div class="login-feature-icon">🔒</div>
                <div><strong>Token-basierte Sicherheit</strong><br>Jeder Agent erhält ein eigenes Token mit kontrollierbarem Zugriff.</div>
              </div>
            </div>
          </div>
          <div class="login-form-side">
            <div class="login-box">
              <div class="login-logo">
                <div class="login-logo-badge">FF</div>
                <h1>FileFlux</h1>
              </div>
              
              <p class="login-title">Melden Sie sich an, um fortzufahren</p>
              
              ${this.loginError ? html`
                <div class="login-error">${this.loginError}</div>
              ` : ''}
              
              <form class="login-form" @submit=${this._handleLogin}>
                <div class="form-group">
                  <label class="form-label" for="email">E-Mail</label>
                  <input class="form-input" type="email" id="email" name="email" placeholder="name@beispiel.de" required>
                </div>
                
                <div class="form-group">
                  <label class="form-label" for="password">Passwort</label>
                  <input class="form-input" type="password" id="password" name="password" placeholder="••••••••" required>
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
          @logout=${this._handleLogout}
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