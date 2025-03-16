import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoUser } from '../../demo-mode';

@customElement('ff-header')
export class Header extends LitElement {
  @property({ type: Boolean }) isSidebarOpen = false;
  @property({ type: String }) currentRoute = 'dashboard';
  @state() private user = {
    name: 'Demo User',
    email: 'demo@example.com'
  };

  constructor() {
    super();
    // Im Demo-Modus den Demo-Benutzer laden
    if (isDemoMode()) {
      const demoUser = getDemoUser();
      this.user = {
        name: demoUser.name,
        email: demoUser.email
      };
    }
  }

  static styles = css`
    :host {
      display: block;
      background-color: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
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
    
    .user-profile {
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 5px;
      border-radius: 4px;
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
  `;

  render() {
    return html`
      <div class="header-container">
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
        
        <div class="user-profile">
          <div class="user-avatar">${this.user.name[0]}</div>
          <span>${this.user.name}</span>
        </div>
      </div>
    `;
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