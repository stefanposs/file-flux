import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { theme } from '../../styles/theme';

@customElement('ff-sidebar-navigation')
export class SidebarNavigation extends LitElement {
  @property({ type: Boolean }) collapsed = false;
  @state() private currentPath = '';

  static styles = css`
    :host {
      display: block;
      height: 100%;
    }

    .sidebar-container {
      display: flex;
      flex-direction: column;
      height: 100%;
    }

    .logo-container {
      padding: 16px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo {
      height: 30px;
      transition: margin 0.3s ease;
    }

    .logo-text {
      color: #ffd202;
      font-weight: bold;
      font-size: 18px;
      margin-left: 8px;
      white-space: nowrap;
      opacity: 1;
      transition: opacity 0.3s ease, width 0.3s ease;
    }

    .collapsed .logo-text {
      opacity: 0;
      width: 0;
      margin-left: 0;
      overflow: hidden;
    }

    .navigation {
      padding: 16px 0;
      flex-grow: 1;
      overflow-y: auto;
    }

    .nav-group {
      margin-bottom: 24px;
    }

    .nav-group-title {
      font-size: 12px;
      text-transform: uppercase;
      color: rgba(255, 255, 255, 0.6);
      padding: 8px 16px;
      white-space: nowrap;
      opacity: 1;
      transition: opacity 0.3s ease;
    }

    .collapsed .nav-group-title {
      opacity: 0;
      height: 0;
      overflow: hidden;
      padding: 0;
      margin: 0;
    }

    .nav-link {
      display: flex;
      align-items: center;
      padding: 16px;
      color: white;
      text-decoration: none;
      transition: background-color 0.2s ease;
      white-space: nowrap;
    }

    .nav-link:hover {
      background-color: rgba(255, 255, 255, 0.1);
    }

    .nav-link.active {
      background-color: #ffd202;
      color: #122e53;
      font-weight: bold;
    }

    .nav-icon {
      margin-right: 8px;
      width: 20px;
      text-align: center;
      transition: margin 0.3s ease;
    }

    .collapsed .nav-icon {
      margin-right: 0;
    }

    .nav-text {
      opacity: 1;
      transition: opacity 0.3s ease;
    }

    .collapsed .nav-text {
      opacity: 0;
      width: 0;
      height: 0;
      overflow: hidden;
    }

    .footer {
      margin-top: auto;
      padding: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      font-size: 12px;
      color: rgba(255, 255, 255, 0.7);
      text-align: center;
      transition: opacity 0.3s ease;
    }

    .collapsed .footer {
      opacity: 0;
      height: 0;
      overflow: hidden;
      padding: 0;
      margin: 0;
      border: none;
    }
  `;

  constructor() {
    super();
    this.currentPath = window.location.pathname;
    window.addEventListener('popstate', () => {
      this.currentPath = window.location.pathname;
    });
  }

  render() {
    return html`
      <div class="sidebar-container ${this.collapsed ? 'collapsed' : ''}">
        <div class="logo-container">
          <img src="/src/assets/logo.svg" alt="File Flux Logo" class="logo" />
          <div class="logo-text">FILE FLUX</div>
        </div>
        
        <nav class="navigation">
          <div class="nav-group">
            <div class="nav-group-title">Hauptmenü</div>
            <a href="/" class="nav-link ${this._isActive('/')}">
              <span class="nav-icon">📊</span> <span class="nav-text">Dashboard</span>
            </a>
            <a href="/jobs" class="nav-link ${this._isActive('/jobs')}">
              <span class="nav-icon">🔄</span> <span class="nav-text">Jobs</span>
            </a>
            <a href="/transfers" class="nav-link ${this._isActive('/transfers')}">
              <span class="nav-icon">📁</span> <span class="nav-text">Transfers</span>
            </a>
          </div>
          
          <div class="nav-group">
            <div class="nav-group-title">Administration</div>
            <a href="/agents" class="nav-link ${this._isActive('/agents')}">
              <span class="nav-icon">🤖</span> <span class="nav-text">Agenten</span>
            </a>
            <a href="/tokens" class="nav-link ${this._isActive('/tokens')}">
              <span class="nav-icon">🔑</span> <span class="nav-text">Tokens</span>
            </a>
            <a href="/settings" class="nav-link ${this._isActive('/settings')}">
              <span class="nav-icon">⚙️</span> <span class="nav-text">Einstellungen</span>
            </a>
          </div>
        </nav>
        
        <div class="footer">
          File Flux v1.0.0
        </div>
      </div>
    `;
  }

  _isActive(path: string) {
    return this.currentPath === path ? 'active' : '';
  }
} 