import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { showToast } from '../shared/toast';
import { api, ApiAgent } from '../../services/api-service';

@customElement('ff-agent-edit')
export class AgentEdit extends LitElement {
  @property({ type: String }) agentId = '';
  @state() private agent: ApiAgent | null = null;
  @state() private isLoading = true;
  @state() private isSaving = false;
  @state() private error: string | null = null;

  static styles = css`
    :host { display: block; }

    .header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 24px; color: var(--gray-900, #111827); margin: 0; font-weight: 700;
    }
    .back-link {
      color: var(--primary-color, #4f46e5); cursor: pointer; font-size: 14px;
      text-decoration: none; font-weight: 500;
    }
    .back-link:hover { text-decoration: underline; }

    .form-card {
      background: #fff; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    .form-row {
      display: grid; grid-template-columns: 1fr 1fr; gap: 20px;
    }
    .form-row .form-group { margin-bottom: 0; }

    label {
      display: block; margin-bottom: 6px; font-weight: 500;
      font-size: 14px; color: var(--gray-700, #374151);
    }
    .form-input {
      width: 100%; padding: 8px 12px; border: 1px solid #dee2e6;
      border-radius: 6px; font-size: 14px; box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      outline: none; border-color: var(--primary-color, #4f46e5);
      box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
    }
    textarea.form-input { resize: vertical; }
    select.form-input { appearance: auto; }

    .form-actions {
      display: flex; justify-content: flex-end; gap: 12px;
      margin-top: 24px; padding-top: 20px; border-top: 1px solid #e9ecef;
    }
    .btn {
      padding: 10px 20px; border-radius: 6px; font-size: 14px;
      font-weight: 600; cursor: pointer; transition: all 0.2s;
    }
    .btn-secondary {
      background: #fff; border: 1px solid #dee2e6; color: var(--gray-700, #374151);
    }
    .btn-secondary:hover { background: var(--gray-50, #f9fafb); }
    .btn-primary {
      background: var(--primary-color, #4f46e5); border: none; color: #fff;
    }
    .btn-primary:hover { background: var(--primary-hover, #4338ca); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .readonly-info {
      display: flex; gap: 24px; flex-wrap: wrap;
      margin-bottom: 24px; padding: 16px;
      background: var(--gray-50, #f9fafb); border-radius: 8px;
    }
    .readonly-item {
      font-size: 13px; color: var(--gray-500, #6b7280);
    }
    .readonly-item strong {
      color: var(--gray-700, #374151);
    }

    .loading-container, .error-container {
      display: flex; justify-content: center; align-items: center;
      padding: 48px; background: #fff; border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    .loading-spinner {
      width: 40px; height: 40px;
      border: 4px solid rgba(79,70,229,0.1); border-left-color: var(--primary-color, #4f46e5);
      border-radius: 50%; animation: spin 1s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .error-message { color: #dc3545; text-align: center; }
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadData();
  }

  async _loadData() {
    try {
      this.isLoading = true;
      this.agent = await api.getAgent(Number(this.agentId));
    } catch (err: any) {
      this.error = 'Fehler beim Laden: ' + (err?.message || 'Unbekannt');
    } finally {
      this.isLoading = false;
    }
  }

  async _handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.agent) return;

    const form = e.target as HTMLFormElement;
    const get = (id: string) => (form.querySelector(`#${id}`) as HTMLInputElement)?.value;

    const name = get('agent-name');
    if (!name) {
      showToast('Bitte gib einen Namen ein.', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      await api.updateAgent(this.agent.id, {
        name,
        type: get('agent-type') || 'standard',
        description: (form.querySelector('#agent-description') as HTMLTextAreaElement)?.value || null,
      });
      showToast('Agent gespeichert!', 'success');
      this._navigateBack();
    } catch (err: any) {
      showToast('Fehler: ' + (err?.message || 'Unbekannt'), 'error');
    } finally {
      this.isSaving = false;
    }
  }

  _navigateBack() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/agents/${this.agentId}` },
      bubbles: true, composed: true
    }));
  }

  render() {
    if (this.isLoading) {
      return html`<div class="loading-container"><div class="loading-spinner"></div></div>`;
    }
    if (this.error || !this.agent) {
      return html`<div class="error-container"><div class="error-message">${this.error || 'Agent nicht gefunden'}</div></div>`;
    }

    const a = this.agent;
    return html`
      <div class="header">
        <h1>Agent bearbeiten</h1>
        <a class="back-link" @click=${this._navigateBack}>← Zurück zum Agent</a>
      </div>

      <div class="form-card">
        <div class="readonly-info">
          <div class="readonly-item"><strong>ID:</strong> ${a.id}</div>
          <div class="readonly-item"><strong>Status:</strong> ${a.status}</div>
          <div class="readonly-item"><strong>IP:</strong> ${a.ip_address || '–'}</div>
          <div class="readonly-item"><strong>System:</strong> ${a.system || '–'}</div>
          <div class="readonly-item"><strong>Version:</strong> ${a.version || '–'}</div>
          <div class="readonly-item"><strong>Zuletzt gesehen:</strong> ${a.last_seen ? new Date(a.last_seen).toLocaleString('de-DE') : '–'}</div>
        </div>

        <form @submit=${this._handleSubmit}>
          <div class="form-group">
            <label for="agent-name">Name *</label>
            <input type="text" id="agent-name" class="form-input" required .value=${a.name}>
          </div>

          <div class="form-group">
            <label for="agent-description">Beschreibung</label>
            <textarea id="agent-description" class="form-input" rows="3">${a.description || ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="agent-type">Typ</label>
              <select id="agent-type" class="form-input">
                <option value="standard" ?selected=${a.type === 'standard'}>Standard</option>
                <option value="relay" ?selected=${a.type === 'relay'}>Relay</option>
                <option value="gateway" ?selected=${a.type === 'gateway'}>Gateway</option>
              </select>
            </div>
          </div>

          <div class="form-actions">
            <button type="button" class="btn btn-secondary" @click=${this._navigateBack}>Abbrechen</button>
            <button type="submit" class="btn btn-primary" ?disabled=${this.isSaving}>
              ${this.isSaving ? 'Wird gespeichert…' : 'Änderungen speichern'}
            </button>
          </div>
        </form>
      </div>
    `;
  }
}
