import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ff-header')
export class Header extends LitElement {
  @property({ type: Boolean }) sidebarOpen = false;
  @property({ type: String }) currentRoute = '/';
  @property({ type: Object }) user = null;
  
  static styles = css`
    :host {
      display: block;
      background-color: #fff;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }
    
    .header-container {
      display: flex;
      justify-content: space-between;
      align-items: center;
      height: 64px;
      padding: 0 20px;
      max-width: 1400px;
      margin: 0 auto;
    }
    
    .header-left {
      display: flex;
      align-items: center;
    }
    
    .logo {
      font-size: 20px;
      font-weight: bold;
      color: #122e53;
      display: flex;
      align-items: center;
      margin-right: 40px;
    }
    
    .logo-icon {
      margin-right: 8px;
      font-size: 24px;
    }
    
    .toggle-button {
      display: none;
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      margin-right: 16px;
      color: #6c757d;
    }
    
    .navigation {
      display: flex;
      gap: 8px;
    }
    
    .navigation.mobile-hidden {
      display: none;
    }
    
    .navigation.mobile-visible {
      display: flex;
    }
    
    .nav-link {
      padding: 8px 16px;
      text-decoration: none;
      color: #6c757d;
      border-radius: 4px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .nav-link:hover {
      background-color: #f8f9fa;
      color: #122e53;
    }
    
    .nav-link.active {
      background-color: rgba(18, 46, 83, 0.05);
      color: #122e53;
    }
    
    .header-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    
    .notifications {
      position: relative;
      cursor: pointer;
    }
    
    .notification-icon {
      font-size: 20px;
      color: #6c757d;
    }
    
    .notification-badge {
      position: absolute;
      top: -5px;
      right: -5px;
      background-color: #dc3545;
      color: white;
      border-radius: 50%;
      width: 18px;
      height: 18px;
      font-size: 12px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .user-profile {
      display: flex;
      align-items: center;
      gap: 8px;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 4px;
    }
    
    .user-profile:hover {
      background-color: #f8f9fa;
    }
    
    .user-avatar {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background-color: #122e53;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: 500;
    }
    
    .user-name {
      font-weight: 500;
    }
    
    @media (max-width: 768px) {
      .toggle-button {
        display: block;
      }
      
      .navigation {
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        background-color: white;
        flex-direction: column;
        padding: 16px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        z-index: 100;
      }
      
      .user-name {
        display: none;
      }
    }
  `;

  render() {
    return html`
      <div class="header-container">
        <div class="header-left">
          <button 
            class="toggle-button" 
            @click=${this._toggleSidebar}
            aria-label="Toggle menu"
          >
            ☰
          </button>
          
          <div class="logo">
            <span class="logo-icon">🔄</span>
            <span>File Flux</span>
          </div>
          
          <nav class="navigation ${this.sidebarOpen ? 'mobile-visible' : 'mobile-hidden'}">
            <a 
              class="nav-link ${this.currentRoute === '/' ? 'active' : ''}" 
              href="/"
            >
              Dashboard
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/jobs') ? 'active' : ''}" 
              href="/jobs"
            >
              Jobs
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/agents') ? 'active' : ''}" 
              href="/agents"
            >
              Agents
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/tokens') ? 'active' : ''}" 
              href="/tokens"
            >
              Tokens
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/transfers') ? 'active' : ''}" 
              href="/transfers"
            >
              Transfers
            </a>
          </nav>
        </div>
        
        <div class="header-right">
          <div class="notifications">
            <span class="notification-icon">🔔</span>
            <span class="notification-badge">3</span>
          </div>
          
          <div class="user-profile" @click=${this._showUserMenu}>
            <div class="user-avatar">
              ${this._getUserInitials()}
            </div>
            <span class="user-name">${this.user?.name || 'Benutzer'}</span>
          </div>
        </div>
      </div>
    `;
  }

  _toggleSidebar() {
    this.dispatchEvent(new CustomEvent('toggle-sidebar'));
  }

  _showUserMenu() {
    alert('Benutzermenü: Einstellungen, Profil, Abmelden');
  }

  _getUserInitials() {
    if (!this.user || !this.user.name) return 'U';
    
    const nameParts = this.user.name.split(' ');
    if (nameParts.length > 1) {
      return `${nameParts[0][0]}${nameParts[1][0]}`;
    }
    
    return nameParts[0][0];
  }
} 