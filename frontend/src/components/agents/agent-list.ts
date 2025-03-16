import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoAgents } from '../../demo-mode';

@customElement('ff-agent-list')
export class AgentList extends LitElement {
  @state() private agents = [];
  @state() private isLoading = true;
  @state() private error = null;
  @state() private searchQuery = '';
  @state() private statusFilter = 'all';
  @state() private typeFilter = 'all';
  @state() private filteredAgents = [];

  static styles = css`
    :host {
      display: block;
    }
    
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    
    h1 {
      font-size: 24px;
      color: #122e53;
      margin: 0;
    }
    
    .action-button {
      background: none;
      border: none;
      width: 32px;
      height: 32px;
      display: flex;
      justify-content: center;
      align-items: center;
      border-radius: 4px;
      cursor: pointer;
      color: #666;
      transition: background-color 0.2s ease;
    }

    .action-button:hover {
      background-color: #f0f0f0;
    }

    .edit-button {
      color: #122e53;
    }

    .delete-button {
      color: #dc3545;
    }

    .token-button {
      color: #ffd202;
    }

    .loading-container, .error-container, .empty-container {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 48px;
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(18, 46, 83, 0.1);
      border-left-color: #122e53;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .error-message {
      color: #dc3545;
      text-align: center;
    }

    .empty-message {
      color: #666;
      text-align: center;
    }

    .last-seen {
      white-space: nowrap;
    }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadAgents();
  }

  async _loadAgents() {
    try {
      this.isLoading = true;
      this.error = null;
      
      if (isDemoMode()) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        this.agents = getDemoAgents();
        this.filteredAgents = [...this.agents];
      } else {
        this.error = 'API noch nicht implementiert';
      }
    } catch (err) {
      this.error = `Fehler beim Laden der Agenten: ${err.message || 'Unbekannter Fehler'}`;
    } finally {
      this.isLoading = false;
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
    
    if (this.error) {
      return html`
        <div class="error-container">
          <div class="error-message">${this.error}</div>
        </div>
      `;
    }
    
    return html`
      <div class="header">
        <h1>Agenten</h1>
        <button class="add-agent-button">Neuen Agenten erstellen</button>
      </div>
      
      <div>
        ${this.agents.map(agent => html`
          <div class="agent-item">
            <h3>${agent.name}</h3>
            <p>Typ: ${agent.type}, Status: ${agent.status}</p>
            <p>System: ${agent.system || 'Unbekannt'}</p>
            <p>IP: ${agent.ipAddress || 'Unbekannt'}</p>
          </div>
        `)}
      </div>
    `;
  }
} 