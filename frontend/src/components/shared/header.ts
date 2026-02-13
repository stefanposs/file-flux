import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { showToast } from './toast';

@customElement('ff-header')
export class Header extends LitElement {
  @property({ type: Boolean }) sidebarOpen = false;
  @property({ type: String }) currentRoute = '/';
  @property({ type: Object }) user: any = null;
  @state() private _userMenuOpen = false;
  
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

    .user-menu-wrapper {
      position: relative;
    }

    .user-menu {
      position: absolute;
      top: 100%;
      right: 0;
      margin-top: 4px;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 200px;
      z-index: 200;
      overflow: hidden;
    }

    .user-menu-header {
      padding: 12px 16px;
      border-bottom: 1px solid #e9ecef;
    }

    .user-menu-header .menu-name {
      font-weight: 600;
      color: #122e53;
    }

    .user-menu-header .menu-email {
      font-size: 13px;
      color: #6c757d;
      margin-top: 2px;
    }

    .user-menu-header .menu-role {
      display: inline-block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: #122e53;
      background: rgba(18, 46, 83, 0.08);
      padding: 2px 8px;
      border-radius: 4px;
      margin-top: 6px;
    }

    .user-menu-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 16px;
      cursor: pointer;
      font-size: 14px;
      color: #333;
      transition: background 0.15s;
      border: none;
      background: none;
      width: 100%;
      text-align: left;
    }

    .user-menu-item:hover {
      background: #f8f9fa;
    }

    .user-menu-item.danger {
      color: #dc3545;
    }

    .user-menu-item.danger:hover {
      background: #fff5f5;
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
              @click=${(e: Event) => this._handleNavClick(e, '/')}
            >
              Dashboard
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/jobs') ? 'active' : ''}" 
              href="/jobs"
              @click=${(e: Event) => this._handleNavClick(e, '/jobs')}
            >
              Jobs
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/agents') ? 'active' : ''}" 
              href="/agents"
              @click=${(e: Event) => this._handleNavClick(e, '/agents')}
            >
              Agents
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/tokens') ? 'active' : ''}" 
              href="/tokens"
              @click=${(e: Event) => this._handleNavClick(e, '/tokens')}
            >
              Tokens
            </a>
            <a 
              class="nav-link ${this.currentRoute.startsWith('/transfers') ? 'active' : ''}" 
              href="/transfers"
              @click=${(e: Event) => this._handleNavClick(e, '/transfers')}
            >
              Transfers
            </a>
          </nav>
        </div>
        
        <div class="header-right">
          <div class="notifications">
            <span class="notification-icon">🔔</span>
          </div>
          
          <div class="user-menu-wrapper">
            <div class="user-profile" @click=${this._toggleUserMenu}>
              <div class="user-avatar">
                ${this._getUserInitials()}
              </div>
              <span class="user-name">${this.user?.name || 'Benutzer'}</span>
            </div>

            ${this._userMenuOpen ? html`
              <div class="user-menu">
                <div class="user-menu-header">
                  <div class="menu-name">${this.user?.name || 'Benutzer'}</div>
                  <div class="menu-email">${this.user?.email || ''}</div>
                  <span class="menu-role">${this.user?.role || 'user'}</span>
                </div>
                <button class="user-menu-item danger" @click=${this._handleLogout}>
                  🚪 Abmelden
                </button>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }

  _toggleSidebar() {
    this.dispatchEvent(new CustomEvent('toggle-sidebar'));
  }

  _toggleUserMenu() {
    this._userMenuOpen = !this._userMenuOpen;
    
    if (this._userMenuOpen) {
      // Close menu when clicking outside
      const closeHandler = (e: MouseEvent) => {
        const path = e.composedPath();
        if (!path.includes(this)) {
          this._userMenuOpen = false;
          document.removeEventListener('click', closeHandler);
        }
      };
      // Delay to prevent immediate close from the same click
      setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }
  }

  _handleLogout() {
    this._userMenuOpen = false;
    this.dispatchEvent(new CustomEvent('logout', {
      bubbles: true,
      composed: true
    }));
  }

  _handleNavClick(e: Event, path: string) {
    e.preventDefault();
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path },
      bubbles: true,
      composed: true
    }));
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