import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { api, ApiAgent, CreateTokenResponse } from '../../services/api-service';
import { showToast } from '../shared/toast';

/**
 * 4-Schritt Agent-Onboarding-Wizard:
 *   1. Agent registrieren (Name, Typ, Beschreibung)
 *   2. Token erstellen (wird automatisch generiert)
 *   3. Agent installieren (Config + Befehle anzeigen)
 *   4. Verbindung prüfen (Polling bis Agent "online")
 */
@customElement('ff-agent-onboarding')
export class AgentOnboarding extends LitElement {
  @state() private currentStep = 1;
  @state() private isSubmitting = false;

  // Step 1 – Agent data
  @state() private agentName = '';
  @state() private agentType = 'client';
  @state() private agentDescription = '';

  // Step 2 – Token result
  @state() private createdAgent: ApiAgent | null = null;
  @state() private createdToken: CreateTokenResponse | null = null;
  @state() private tokenCopied = false;

  // Step 4 – Connection check
  @state() private connectionStatus: 'waiting' | 'connected' | 'timeout' = 'waiting';
  private pollTimer: number | null = null;
  private pollStartTime = 0;

  static styles = css`
    :host {
      display: block;
    }

    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      backdrop-filter: blur(2px);
    }

    .wizard {
      background: white;
      border-radius: var(--radius-lg, 12px);
      box-shadow: var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.15));
      width: 640px;
      max-width: 92vw;
      max-height: 88vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    /* ── Header ─────────────────────────────────── */
    .wizard-header {
      padding: 24px 28px 20px;
      border-bottom: 1px solid var(--gray-200, #e5e7eb);
    }

    .wizard-header h2 {
      margin: 0 0 20px;
      font-size: 20px;
      font-weight: 700;
      color: var(--gray-900, #111827);
    }

    /* ── Stepper ────────────────────────────────── */
    .stepper {
      display: flex;
      align-items: center;
      gap: 0;
    }

    .step-item {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .step-item:not(:last-child)::after {
      content: '';
      flex: 1;
      height: 2px;
      background: var(--gray-200, #e5e7eb);
      margin: 0 8px;
    }

    .step-item.active:not(:last-child)::after,
    .step-item.done:not(:last-child)::after {
      background: var(--primary-color, #4f46e5);
    }

    .step-circle {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 700;
      flex-shrink: 0;
      transition: all 0.2s;
    }

    .step-item.done .step-circle {
      background: var(--success-color, #10b981);
      color: white;
    }

    .step-item.active .step-circle {
      background: var(--primary-color, #4f46e5);
      color: white;
    }

    .step-item.pending .step-circle {
      background: var(--gray-100, #f3f4f6);
      color: var(--gray-400, #9ca3af);
      border: 2px solid var(--gray-300, #d1d5db);
    }

    .step-label {
      font-size: 12px;
      font-weight: 600;
      white-space: nowrap;
      color: var(--gray-500, #6b7280);
    }

    .step-item.active .step-label {
      color: var(--primary-color, #4f46e5);
    }

    .step-item.done .step-label {
      color: var(--success-color, #10b981);
    }

    /* ── Body ───────────────────────────────────── */
    .wizard-body {
      padding: 28px;
      overflow-y: auto;
      flex: 1;
    }

    .step-title {
      font-size: 17px;
      font-weight: 700;
      color: var(--gray-900, #111827);
      margin: 0 0 4px;
    }

    .step-subtitle {
      font-size: 13px;
      color: var(--gray-500, #6b7280);
      margin: 0 0 24px;
    }

    /* Form elements */
    .form-group {
      margin-bottom: 18px;
    }

    .form-group label {
      display: block;
      font-size: 13px;
      font-weight: 600;
      color: var(--gray-700, #374151);
      margin-bottom: 6px;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
      width: 100%;
      padding: 10px 12px;
      border: 1px solid var(--gray-300, #d1d5db);
      border-radius: var(--radius-md, 8px);
      font-size: 14px;
      font-family: inherit;
      transition: border-color 0.15s, box-shadow 0.15s;
      box-sizing: border-box;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
      outline: none;
      border-color: var(--primary-color, #4f46e5);
      box-shadow: 0 0 0 3px var(--primary-light, rgba(79,70,229,0.1));
    }

    .form-group textarea {
      min-height: 72px;
      resize: vertical;
    }

    .form-hint {
      font-size: 12px;
      color: var(--gray-400, #9ca3af);
      margin-top: 4px;
    }

    /* Token display */
    .token-display {
      background: var(--gray-900, #111827);
      border-radius: var(--radius-md, 8px);
      padding: 16px;
      margin: 16px 0;
      position: relative;
    }

    .token-value {
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      color: #10b981;
      font-size: 13px;
      word-break: break-all;
      line-height: 1.5;
    }

    .token-warning {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      padding: 12px 14px;
      background: var(--warning-light, #fef3c7);
      border: 1px solid var(--warning-color, #f59e0b);
      border-radius: var(--radius-md, 8px);
      margin-top: 12px;
    }

    .token-warning-icon {
      font-size: 16px;
      flex-shrink: 0;
      line-height: 1.4;
    }

    .token-warning p {
      margin: 0;
      font-size: 13px;
      color: var(--gray-700, #374151);
      line-height: 1.4;
    }

    /* Code blocks */
    .code-block {
      background: var(--gray-900, #111827);
      border-radius: var(--radius-md, 8px);
      padding: 16px;
      margin: 12px 0;
      position: relative;
    }

    .code-block pre {
      margin: 0;
      font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
      font-size: 13px;
      color: #e5e7eb;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }

    .copy-btn {
      position: absolute;
      top: 8px;
      right: 8px;
      background: var(--gray-700, #374151);
      color: var(--gray-300, #d1d5db);
      border: none;
      border-radius: var(--radius-sm, 4px);
      padding: 4px 10px;
      font-size: 11px;
      cursor: pointer;
      transition: background 0.15s;
    }

    .copy-btn:hover {
      background: var(--gray-600, #4b5563);
      color: white;
    }

    .copy-btn.copied {
      background: var(--success-color, #10b981);
      color: white;
    }

    /* Config label */
    .config-label {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--gray-400, #9ca3af);
      margin: 20px 0 6px;
    }

    /* Connection status */
    .connection-check {
      text-align: center;
      padding: 32px 0;
    }

    .status-icon {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 20px;
      font-size: 28px;
    }

    .status-icon.waiting {
      background: var(--primary-light, rgba(79,70,229,0.1));
      animation: pulse 2s infinite;
    }

    .status-icon.connected {
      background: var(--success-light, #d1fae5);
    }

    .status-icon.timeout {
      background: var(--warning-light, #fef3c7);
    }

    @keyframes pulse {
      0%, 100% { transform: scale(1); opacity: 1; }
      50% { transform: scale(1.08); opacity: 0.8; }
    }

    .status-text {
      font-size: 15px;
      font-weight: 600;
      color: var(--gray-900, #111827);
      margin: 0 0 6px;
    }

    .status-detail {
      font-size: 13px;
      color: var(--gray-500, #6b7280);
      margin: 0;
    }

    .troubleshoot {
      margin-top: 24px;
      text-align: left;
      padding: 16px;
      background: var(--gray-50, #f9fafb);
      border-radius: var(--radius-md, 8px);
    }

    .troubleshoot h4 {
      font-size: 13px;
      font-weight: 700;
      color: var(--gray-700, #374151);
      margin: 0 0 8px;
    }

    .troubleshoot li {
      font-size: 13px;
      color: var(--gray-600, #4b5563);
      margin-bottom: 4px;
    }

    /* ── Footer ─────────────────────────────────── */
    .wizard-footer {
      padding: 16px 28px;
      border-top: 1px solid var(--gray-200, #e5e7eb);
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }

    .btn {
      padding: 10px 20px;
      border-radius: var(--radius-md, 8px);
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      border: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: var(--gray-100, #f3f4f6);
      color: var(--gray-700, #374151);
    }

    .btn-secondary:hover:not(:disabled) {
      background: var(--gray-200, #e5e7eb);
    }

    .btn-primary {
      background: var(--primary-color, #4f46e5);
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: var(--primary-hover, #4338ca);
    }

    .btn-success {
      background: var(--success-color, #10b981);
      color: white;
    }

    .btn-success:hover:not(:disabled) {
      background: #059669;
    }

    /* Spinner */
    .spinner-inline {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255,255,255,0.3);
      border-top-color: white;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
      display: inline-block;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .info-card {
      background: var(--primary-light, rgba(79,70,229,0.1));
      border: 1px solid var(--primary-color, #4f46e5);
      border-radius: var(--radius-md, 8px);
      padding: 14px 16px;
      margin-top: 16px;
    }

    .info-card p {
      margin: 0;
      font-size: 13px;
      color: var(--gray-700, #374151);
      line-height: 1.5;
    }

    .info-card strong {
      color: var(--primary-color, #4f46e5);
    }
  `;

  disconnectedCallback() {
    super.disconnectedCallback();
    this._stopPolling();
  }

  // ── Stepper ──────────────────────────────────────────────────────

  private _getStepState(step: number): string {
    if (step < this.currentStep) return 'done';
    if (step === this.currentStep) return 'active';
    return 'pending';
  }

  private _renderStepper() {
    const steps = [
      { num: 1, label: 'Registrieren' },
      { num: 2, label: 'Token' },
      { num: 3, label: 'Installieren' },
      { num: 4, label: 'Verbinden' },
    ];

    return html`
      <div class="stepper">
        ${steps.map(s => html`
          <div class="step-item ${this._getStepState(s.num)}">
            <span class="step-circle">
              ${this._getStepState(s.num) === 'done' ? '✓' : s.num}
            </span>
            <span class="step-label">${s.label}</span>
          </div>
        `)}
      </div>
    `;
  }

  // ── Step 1: Agent registrieren ──────────────────────────────────

  private _renderStep1() {
    return html`
      <h3 class="step-title">Agent registrieren</h3>
      <p class="step-subtitle">Geben Sie Ihrem Agent einen Namen und wählen Sie den Typ.</p>

      <div class="form-group">
        <label for="agent-name">Name *</label>
        <input
          id="agent-name"
          type="text"
          placeholder="z.B. backup-server-01"
          .value=${this.agentName}
          @input=${(e: InputEvent) => this.agentName = (e.target as HTMLInputElement).value}
        />
        <p class="form-hint">Ein eindeutiger Name zur Identifizierung des Agents</p>
      </div>

      <div class="form-group">
        <label for="agent-type">Typ</label>
        <select
          id="agent-type"
          .value=${this.agentType}
          @change=${(e: Event) => this.agentType = (e.target as HTMLSelectElement).value}
        >
          <option value="client">Client – sendet &amp; empfängt Dateien</option>
          <option value="server">Server – zentraler Knotenpunkt</option>
        </select>
      </div>

      <div class="form-group">
        <label for="agent-desc">Beschreibung</label>
        <textarea
          id="agent-desc"
          placeholder="Optional: Standort, Zweck, Team…"
          .value=${this.agentDescription}
          @input=${(e: InputEvent) => this.agentDescription = (e.target as HTMLTextAreaElement).value}
        ></textarea>
      </div>
    `;
  }

  private async _submitStep1() {
    if (!this.agentName.trim()) {
      showToast('Bitte geben Sie einen Agent-Namen ein', 'error');
      return;
    }

    this.isSubmitting = true;
    try {
      const agent = await api.createAgent({
        name: this.agentName.trim(),
        type: this.agentType,
        description: this.agentDescription.trim() || undefined,
      });
      this.createdAgent = agent;
      this.currentStep = 2;

      // Auto-create token for this agent
      const token = await api.createToken({
        name: `${agent.name}-token`,
        agent_id: agent.id,
      });
      this.createdToken = token;
    } catch (err: any) {
      showToast(err.message || 'Agent konnte nicht erstellt werden', 'error');
    } finally {
      this.isSubmitting = false;
    }
  }

  // ── Step 2: Token anzeigen ──────────────────────────────────────

  private _renderStep2() {
    if (!this.createdToken || !this.createdAgent) return html`<p>Laden…</p>`;

    return html`
      <h3 class="step-title">Agent-Token erstellt</h3>
      <p class="step-subtitle">
        Dieses Token authentifiziert <strong>${this.createdAgent.name}</strong> am FileFlux-Server.
      </p>

      <div class="token-display">
        <span class="token-value">${this.createdToken.value}</span>
        <button
          class="copy-btn ${this.tokenCopied ? 'copied' : ''}"
          @click=${() => this._copyToken()}
        >
          ${this.tokenCopied ? 'Kopiert ✓' : 'Kopieren'}
        </button>
      </div>

      <div class="token-warning">
        <span class="token-warning-icon">⚠</span>
        <p>
          <strong>Wichtig:</strong> Dieses Token wird nur einmal angezeigt.
          Kopieren Sie es jetzt und bewahren Sie es sicher auf.
          Sie benötigen es im nächsten Schritt für die Konfiguration.
        </p>
      </div>

      <div class="info-card">
        <p>
          Agent-ID: <strong>#${this.createdAgent.id}</strong> &nbsp;|&nbsp;
          Token-Name: <strong>${this.createdToken.token.name}</strong>
        </p>
      </div>
    `;
  }

  private async _copyToken() {
    if (!this.createdToken) return;
    try {
      await navigator.clipboard.writeText(this.createdToken.value);
      this.tokenCopied = true;
      showToast('Token kopiert', 'success');
    } catch {
      showToast('Kopieren fehlgeschlagen', 'error');
    }
  }

  // ── Step 3: Installation ────────────────────────────────────────

  private _renderStep3() {
    if (!this.createdAgent || !this.createdToken) return html`<p>Laden…</p>`;

    const serverUrl = window.location.origin;
    const configYaml = `server:
  url: "${serverUrl}"
  port: 3001

agent:
  name: "${this.createdAgent.name}"
  type: "${this.createdAgent.type}"
  token: "${this.createdToken.value}"

paths:
  upload: "/data/uploads"
  download: "/data/downloads"`;

    const installCmd = 'curl -sSL https://get.fileflux.io | bash';
    const startCmd = 'sudo systemctl enable --now fileflux-agent';

    return html`
      <h3 class="step-title">Agent installieren &amp; konfigurieren</h3>
      <p class="step-subtitle">Führen Sie diese Schritte auf dem Zielsystem aus.</p>

      <p class="config-label">1. Installation (Linux / macOS)</p>
      <div class="code-block">
        <pre>${installCmd}</pre>
        <button class="copy-btn" @click=${() => this._copy(installCmd)}>Kopieren</button>
      </div>

      <p class="config-label">2. Konfiguration → /etc/fileflux/config.yaml</p>
      <div class="code-block">
        <pre>${configYaml}</pre>
        <button class="copy-btn" @click=${() => this._copy(configYaml)}>Kopieren</button>
      </div>

      <p class="config-label">3. Agent starten</p>
      <div class="code-block">
        <pre>${startCmd}</pre>
        <button class="copy-btn" @click=${() => this._copy(startCmd)}>Kopieren</button>
      </div>
    `;
  }

  // ── Step 4: Verbindung prüfen ───────────────────────────────────

  private _renderStep4() {
    if (this.connectionStatus === 'connected') {
      return html`
        <div class="connection-check">
          <div class="status-icon connected">✓</div>
          <p class="status-text">Agent verbunden!</p>
          <p class="status-detail">
            <strong>${this.createdAgent?.name}</strong> ist online
            und bereit für Dateiübertragungen.
          </p>
        </div>
      `;
    }

    if (this.connectionStatus === 'timeout') {
      return html`
        <div class="connection-check">
          <div class="status-icon timeout">!</div>
          <p class="status-text">Keine Verbindung erkannt</p>
          <p class="status-detail">Der Agent hat sich innerhalb von 60 Sekunden nicht verbunden.</p>

          <div class="troubleshoot">
            <h4>Fehlerbehebung</h4>
            <ul>
              <li>Prüfen Sie, ob der Agent-Dienst läuft: <code>systemctl status fileflux-agent</code></li>
              <li>Prüfen Sie die Logs: <code>journalctl -u fileflux-agent -f</code></li>
              <li>Stimmt die Server-URL in der <code>config.yaml</code>?</li>
              <li>Ist das Token korrekt kopiert?</li>
              <li>Prüfen Sie Firewall-Regeln (Port 3001, WebSocket)</li>
            </ul>
          </div>

          <button class="btn btn-primary" style="margin-top: 16px" @click=${() => this._startPolling()}>
            Erneut prüfen
          </button>
        </div>
      `;
    }

    // Waiting
    return html`
      <div class="connection-check">
        <div class="status-icon waiting">
          <span class="spinner-inline" style="width:28px;height:28px;border-width:3px"></span>
        </div>
        <p class="status-text">Warte auf Verbindung…</p>
        <p class="status-detail">
          Starten Sie den Agent – die Verbindung wird automatisch erkannt.
        </p>
      </div>
    `;
  }

  private _startPolling() {
    this.connectionStatus = 'waiting';
    this.pollStartTime = Date.now();
    this._poll();
  }

  private _stopPolling() {
    if (this.pollTimer !== null) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private async _poll() {
    if (!this.createdAgent) return;

    // Timeout after 60 s
    if (Date.now() - this.pollStartTime > 60_000) {
      this.connectionStatus = 'timeout';
      return;
    }

    try {
      const agent = await api.getAgent(this.createdAgent.id);
      if (agent.status === 'online') {
        this.connectionStatus = 'connected';
        return;
      }
    } catch {
      // Server not reachable, keep polling
    }

    this.pollTimer = window.setTimeout(() => this._poll(), 3000);
  }

  // ── Copy helper ─────────────────────────────────────────────────

  private async _copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Kopiert', 'success');
    } catch {
      showToast('Kopieren fehlgeschlagen', 'error');
    }
  }

  // ── Navigation ──────────────────────────────────────────────────

  private _canNext(): boolean {
    switch (this.currentStep) {
      case 1: return this.agentName.trim().length >= 2;
      case 2: return true;
      case 3: return true;
      case 4: return this.connectionStatus === 'connected';
      default: return false;
    }
  }

  private async _next() {
    if (this.currentStep === 1) {
      await this._submitStep1();
      return; // step advances inside _submitStep1
    }

    if (this.currentStep < 4) {
      this.currentStep++;
      if (this.currentStep === 4) {
        this._startPolling();
      }
    }
  }

  private _close() {
    this._stopPolling();
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }));
  }

  private _finish() {
    this._stopPolling();
    this.dispatchEvent(new CustomEvent('close', {
      bubbles: true, composed: true,
      detail: { agent: this.createdAgent },
    }));
  }

  // ── Render ──────────────────────────────────────────────────────

  render() {
    const stepContent = [
      () => this._renderStep1(),
      () => this._renderStep2(),
      () => this._renderStep3(),
      () => this._renderStep4(),
    ][this.currentStep - 1]();

    const isLast = this.currentStep === 4;
    const isConnected = this.connectionStatus === 'connected';

    return html`
      <div class="overlay" @click=${(e: Event) => {
        if ((e.target as HTMLElement).classList.contains('overlay')) this._close();
      }}>
        <div class="wizard">
          <div class="wizard-header">
            <h2>Neuen Agent einrichten</h2>
            ${this._renderStepper()}
          </div>

          <div class="wizard-body">
            ${stepContent}
          </div>

          <div class="wizard-footer">
            <button class="btn btn-secondary" @click=${this._close}>
              Abbrechen
            </button>

            <div style="display:flex;gap:8px">
              ${this.currentStep > 1 && !isLast ? html`
                <button class="btn btn-secondary" @click=${() => { this.currentStep--; }}>
                  Zurück
                </button>
              ` : ''}

              ${isLast && isConnected ? html`
                <button class="btn btn-success" @click=${this._finish}>
                  Abschließen
                </button>
              ` : isLast ? html`
                <button class="btn btn-secondary" @click=${this._finish}>
                  Später verbinden
                </button>
              ` : html`
                <button
                  class="btn btn-primary"
                  ?disabled=${!this._canNext() || this.isSubmitting}
                  @click=${this._next}
                >
                  ${this.isSubmitting ? html`<span class="spinner-inline"></span> Erstelle…` : 'Weiter →'}
                </button>
              `}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
