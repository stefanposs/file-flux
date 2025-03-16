import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoUser } from '../../demo-mode';

if (!customElements.get('ff-header')) {
  @customElement('ff-header')
  export class Header extends LitElement {
    @property({ type: Boolean }) isSidebarOpen = false;
    @property({ type: Boolean }) isMobile = false;
    @property({ type: String }) currentRoute = 'dashboard';
    @state() private showProfileMenu = false;
    @state() private showNotifications = false;
    @state() private notifications = [
      { id: 1, message: 'Job "Daily Backup" erfolgreich abgeschlossen', time: '10:15', read: false },
      { id: 2, message: 'Neue Version 1.2.0 verfügbar', time: '09:30', read: false },
      { id: 3, message: 'Agent "Server-01" ist offline gegangen', time: 'Gestern', read: true }
    ];
    @state() private user = {
      name: 'Demo User',
      email: 'demo@example.com',
      avatar: null
    };

    constructor() {
      super();
      // Im Demo-Modus den Demo-Benutzer laden
      if (isDemoMode()) {
        const demoUser = getDemoUser();
        this.user = {
          name: demoUser.name,
          email: demoUser.email,
          avatar: null
        };
      } else {
        // Echten Benutzer aus dem localStorage laden
        const userJson = localStorage.getItem('fileFluxUser');
        if (userJson) {
          const userData = JSON.parse(userJson);
          this.user = {
            name: userData.username || 'Benutzer',
            email: userData.email || 'user@example.com',
            avatar: null
          };
        }
      }
    }

    static styles = css`
      :host {
        display: block;
        background-color: white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        margin-bottom: 20px;
        position: sticky;
        top: 0;
        z-index: 100;
      }
      
      .header-container {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0 20px;
        height: 60px;
        max-width: 1200px;
        margin: 0 auto;
      }
      
      .logo-container {
        display: flex;
        align-items: center;
        font-size: 20px;
        font-weight: bold;
        color: #122e53;
        text-decoration: none;
      }
      
      .logo-icon {
        margin-right: 10px;
        font-size: 24px;
      }
      
      .nav-container {
        flex: 1;
        display: flex;
        justify-content: center;
      }
      
      .nav-list {
        display: flex;
        list-style-type: none;
        margin: 0;
        padding: 0;
      }
      
      .nav-item {
        margin: 0 10px;
      }
      
      .nav-link {
        display: block;
        padding: 10px 15px;
        color: #555;
        text-decoration: none;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
        font-weight: 500;
      }
      
      .nav-link:hover {
        color: #122e53;
      }
      
      .nav-link.active {
        color: #122e53;
        border-bottom-color: #122e53;
      }
      
      .actions-container {
        display: flex;
        align-items: center;
      }
      
      .notification-icon {
        position: relative;
        margin-right: 20px;
        cursor: pointer;
        font-size: 20px;
      }
      
      .notification-badge {
        position: absolute;
        top: -5px;
        right: -5px;
        background-color: #f44336;
        color: white;
        font-size: 10px;
        font-weight: bold;
        width: 15px;
        height: 15px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .user-profile {
        display: flex;
        align-items: center;
        cursor: pointer;
        padding: 5px;
        border-radius: 4px;
      }
      
      .user-profile:hover {
        background-color: #f5f5f5;
      }
      
      .user-avatar {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        background-color: #122e53;
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
        margin-right: 10px;
      }
      
      .user-name {
        font-weight: 500;
      }
      
      .mobile-menu-button {
        display: none;
        background: none;
        border: none;
        font-size: 24px;
        cursor: pointer;
        color: #122e53;
      }
      
      @media (max-width: 768px) {
        .nav-container {
          display: none;
        }
        
        .mobile-menu-button {
          display: block;
        }
      }
    `;

    render() {
      return html`
        <div class="header-container">
          <button class="mobile-menu-button" @click=${this._toggleSidebar}>
            ☰
          </button>
          
          <a href="/" class="logo-container" @click=${(e) => this._navigate(e, 'dashboard')}>
            <span class="logo-icon">📁</span>
            <span>File Flux</span>
          </a>
          
          <nav class="nav-container">
            <ul class="nav-list">
              <li class="nav-item">
                <a href="/dashboard" class="nav-link ${this.currentRoute === 'dashboard' ? 'active' : ''}" 
                   @click=${(e) => this._navigate(e, 'dashboard')}>Dashboard</a>
              </li>
              <li class="nav-item">
                <a href="/jobs" class="nav-link ${this.currentRoute === 'jobs' ? 'active' : ''}" 
                   @click=${(e) => this._navigate(e, 'jobs')}>Jobs</a>
              </li>
              <li class="nav-item">
                <a href="/agents" class="nav-link ${this.currentRoute === 'agents' ? 'active' : ''}" 
                   @click=${(e) => this._navigate(e, 'agents')}>Agenten</a>
              </li>
              <li class="nav-item">
                <a href="/tokens" class="nav-link ${this.currentRoute === 'tokens' ? 'active' : ''}" 
                   @click=${(e) => this._navigate(e, 'tokens')}>Tokens</a>
              </li>
              <li class="nav-item">
                <a href="/transfers" class="nav-link ${this.currentRoute === 'transfers' ? 'active' : ''}" 
                   @click=${(e) => this._navigate(e, 'transfers')}>Transfers</a>
              </li>
            </ul>
          </nav>
          
          <div class="actions-container">
            <div class="notification-icon">
              🔔
              <span class="notification-badge">3</span>
            </div>
            
            <div class="user-profile">
              <div class="user-avatar">D</div>
              <span class="user-name">Demo</span>
            </div>
          </div>
        </div>
      `;
    }

    _toggleSidebar() {
      this.isSidebarOpen = !this.isSidebarOpen;
      this.dispatchEvent(new CustomEvent('toggle-sidebar', {
        bubbles: true,
        composed: true
      }));
    }

    _navigate(e, route) {
      e.preventDefault();
      this.currentRoute = route;
      this.dispatchEvent(new CustomEvent('navigate', {
        detail: { route },
        bubbles: true,
        composed: true
      }));
    }
  }
} 