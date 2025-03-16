import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

if (!customElements.get('ff-job-detail')) {
  @customElement('ff-job-detail')
  export class JobDetail extends LitElement {
    @property({ type: String }) jobId = '';

    render() {
      return html`<div>Job-Details für ID: ${this.jobId} werden geladen...</div>`;
    }

    _formatCronExpression(cron: string): string {
      // Vereinfachte Darstellung von Cron-Ausdrücken
      if (cron === '0 0 * * *') return 'Täglich um Mitternacht';
      if (cron === '0 12 * * 1-5') return 'Werktags um 12 Uhr';
      if (cron === '0 23 * * *') return 'Täglich um 23 Uhr';
      return cron;
    }

    _formatDate(dateStr: string): string {
      const date = new Date(dateStr);
      return date.toLocaleDateString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    _formatDateTime(dateStr: string): string {
      const date = new Date(dateStr);
      return date.toLocaleString('de-DE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    }

    _formatFileSize(bytes: number): string {
      if (bytes === 0) return '0 Bytes';
      
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    _formatSpeed(bytesPerSecond: number): string {
      return this._formatFileSize(bytesPerSecond) + '/s';
    }

    _formatStatus(status: string): string {
      switch (status) {
        case 'completed': return 'Erfolgreich';
        case 'failed': return 'Fehlgeschlagen';
        case 'running': return 'Wird ausgeführt';
        case 'pending': return 'Ausstehend';
        default: return status;
      }
    }

    _navigateBack() {
      window.location.href = '/jobs';
    }

    _editJob() {
      if (this.job) {
        window.location.href = `/jobs/edit/${this.job.id}`;
      }
    }

    _pauseJob() {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      if (this.job) {
        this.job = { ...this.job, status: 'inactive' };
      }
    }

    _startJob() {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      if (this.job) {
        this.job = { ...this.job, status: 'active' };
      }
    }

    _showDeleteConfirm() {
      this.showConfirmDelete = true;
    }

    _cancelDelete() {
      this.showConfirmDelete = false;
    }

    _confirmDelete() {
      // In einer echten Implementierung würde hier ein API-Aufruf erfolgen
      alert(`Job "${this.job?.name}" würde jetzt gelöscht werden.`);
      this.showConfirmDelete = false;
      this._navigateBack();
    }
  }
} 