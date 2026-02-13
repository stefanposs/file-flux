import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { showToast } from '../shared/toast';
import { api, ApiAgent, ApiJob } from '../../services/api-service';

@customElement('ff-job-edit')
export class JobEdit extends LitElement {
  @property({ type: String }) jobId = '';
  @state() private job: ApiJob | null = null;
  @state() private agents: ApiAgent[] = [];
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
      const [job, agents] = await Promise.all([
        api.getJob(Number(this.jobId)),
        api.getAgents(),
      ]);
      this.job = job;
      this.agents = agents;
    } catch (err: any) {
      this.error = 'Fehler beim Laden: ' + (err?.message || 'Unbekannt');
    } finally {
      this.isLoading = false;
    }
  }

  async _handleSubmit(e: Event) {
    e.preventDefault();
    if (!this.job) return;

    const form = e.target as HTMLFormElement;
    const get = (id: string) => (form.querySelector(`#${id}`) as HTMLInputElement)?.value;

    const name = get('job-name');
    const sourceAgent = get('job-source-agent');
    const destAgent = get('job-dest-agent');
    if (!name || !sourceAgent || !destAgent) {
      showToast('Bitte fülle alle Pflichtfelder aus.', 'warning');
      return;
    }

    this.isSaving = true;
    try {
      await api.updateJob(this.job.id, {
        name,
        type: get('job-type') || 'push',
        source_path: get('job-source') || '',
        destination_path: get('job-destination') || '',
        source_agent_id: Number(sourceAgent),
        destination_agent_id: Number(destAgent),
        schedule: get('job-schedule') || null,
        description: (form.querySelector('#job-description') as HTMLTextAreaElement)?.value || null,
      });
      showToast('Job gespeichert!', 'success');
      this._navigateBack();
    } catch (err: any) {
      showToast('Fehler: ' + (err?.message || 'Unbekannt'), 'error');
    } finally {
      this.isSaving = false;
    }
  }

  _navigateBack() {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/jobs/${this.jobId}` },
      bubbles: true, composed: true
    }));
  }

  render() {
    if (this.isLoading) {
      return html`<div class="loading-container"><div class="loading-spinner"></div></div>`;
    }
    if (this.error || !this.job) {
      return html`<div class="error-container"><div class="error-message">${this.error || 'Job nicht gefunden'}</div></div>`;
    }

    const j = this.job;
    return html`
      <div class="header">
        <h1>Job bearbeiten</h1>
        <a class="back-link" @click=${this._navigateBack}>← Zurück zum Job</a>
      </div>

      <div class="form-card">
        <form @submit=${this._handleSubmit}>
          <div class="form-group">
            <label for="job-name">Name *</label>
            <input type="text" id="job-name" class="form-input" required .value=${j.name}>
          </div>

          <div class="form-group">
            <label for="job-description">Beschreibung</label>
            <textarea id="job-description" class="form-input" rows="3">${j.description || ''}</textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="job-type">Typ *</label>
              <select id="job-type" class="form-input" required>
                <option value="push" ?selected=${j.type === 'push'}>Push</option>
                <option value="pull" ?selected=${j.type === 'pull'}>Pull</option>
              </select>
            </div>
            <div class="form-group">
              <label for="job-schedule">Zeitplan (Cron)</label>
              <input type="text" id="job-schedule" class="form-input" .value=${j.schedule || ''} placeholder="z.B. 0 0 * * *">
            </div>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="job-source-agent">Quell-Agent *</label>
              <select id="job-source-agent" class="form-input" required>
                <option value="">Agent wählen…</option>
                ${this.agents.map(a => html`
                  <option value="${a.id}" ?selected=${a.id === j.source_agent_id}>${a.name}</option>
                `)}
              </select>
            </div>
            <div class="form-group">
              <label for="job-dest-agent">Ziel-Agent *</label>
              <select id="job-dest-agent" class="form-input" required>
                <option value="">Agent wählen…</option>
                ${this.agents.map(a => html`
                  <option value="${a.id}" ?selected=${a.id === j.destination_agent_id}>${a.name}</option>
                `)}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label for="job-source">Quellpfad *</label>
            <input type="text" id="job-source" class="form-input" required .value=${j.source_path}>
          </div>

          <div class="form-group">
            <label for="job-destination">Zielpfad *</label>
            <input type="text" id="job-destination" class="form-input" required .value=${j.destination_path}>
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
