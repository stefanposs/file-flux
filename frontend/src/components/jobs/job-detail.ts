import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { isDemoMode, getDemoJobs } from '../../demo-mode';

@customElement('ff-job-detail')
export class JobDetail extends LitElement {
  @property({ type: String }) jobId = '';
  @state() private isLoading = true;
  @state() private job = null;
  @state() private error = null;

  static styles = css`
    :host {
      display: block;
    }
    
    .loading-container, .error-container {
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
    
    /* Weitere CSS-Stile hier */
  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadJobDetails();
  }

  async _loadJobDetails() {
    try {
      this.isLoading = true;
      
      if (isDemoMode()) {
        // Im Demo-Modus Daten aus den Demo-Daten laden
        await new Promise(resolve => setTimeout(resolve, 800)); // Simuliere Netzwerklatenz
        const jobs = getDemoJobs();
        const job = jobs.find(j => j.id === this.jobId);
        
        if (job) {
          this.job = job;
        } else {
          this.error = 'Job nicht gefunden';
        }
      } else {
        // Hier würde später der API-Aufruf kommen
        this.error = 'API noch nicht implementiert';
      }
    } catch (err) {
      this.error = 'Fehler beim Laden des Jobs: ' + (err instanceof Error ? err.message : String(err));
      console.error('Error loading job:', err);
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
          <div class="error-message">
            <div>🚫 ${this.error}</div>
            <button @click=${this._loadJobDetails}>Erneut versuchen</button>
          </div>
        </div>
      `;
    }

    if (!this.job) {
      return html`
        <div class="error-container">
          <div class="error-message">
            <div>Job nicht gefunden</div>
            <button @click=${this._navigateBack}>Zurück zur Job-Liste</button>
          </div>
        </div>
      `;
    }

    // Der Hauptinhalt der Job-Detailansicht
    return html`
      <div>
        <div class="header">
          <button class="back-button" @click=${this._navigateBack}>
            ← Zurück zur Job-Liste
          </button>
          
          <h1 class="job-name">${this.job.name}</h1>
          
          <div class="job-actions">
            <button class="job-action-button" @click=${this._editJob}>
              ✏️ Bearbeiten
            </button>
            <button class="job-action-button delete-button" @click=${this._deleteJob}>
              🗑️ Löschen
            </button>
          </div>
        </div>
        
        <!-- Hier weitere Details des Jobs anzeigen -->
        <div class="job-details">
          <div class="detail-item">
            <div class="detail-label">Status</div>
            <div class="detail-value">
              <span class="status-badge status-${this.job.status}">
                ${this._formatStatus(this.job.status)}
              </span>
            </div>
          </div>
          
          <!-- Weitere Eigenschaften des Jobs hier anzeigen -->
        </div>
      </div>
    `;
  }

  _formatStatus(status) {
    switch (status) {
      case 'completed': return 'Abgeschlossen';
      case 'running': return 'Wird ausgeführt';
      case 'pending': return 'Ausstehend';
      case 'failed': return 'Fehlgeschlagen';
      default: return status;
    }
  }

  _navigateBack() {
    window.location.href = '/jobs';
  }

  _editJob() {
    window.location.href = `/jobs/edit/${this.jobId}`;
  }

  _deleteJob() {
    if (confirm(`Möchten Sie den Job "${this.job.name}" wirklich löschen?`)) {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      alert(`Job "${this.job.name}" würde jetzt gelöscht werden.`);
      this._navigateBack();
    }
  }
} 