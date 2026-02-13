import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { showToast } from '../shared/toast';
import { api } from '../../services/api-service';
import { isDemoMode, getDemoUser } from '../../demo-mode';

@customElement('ff-settings')
export class SettingsPage extends LitElement {
  @state() private user: any = null;
  @state() private isLoading = true;

  // Form states
  @state() private currentPassword = '';
  @state() private newPassword = '';
  @state() private confirmPassword = '';
  @state() private isSavingPassword = false;

  // Preferences (persisted in localStorage)
  @state() private emailNotifications = true;
  @state() private agentWarnings = true;
  @state() private weeklyReport = false;
  @state() private compactView = false;
  @state() private collapseSidebar = false;

  static styles = css`
    :host { display: block; }

    .header {
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 24px; color: var(--ff-gray-900, #111827); margin: 0; font-weight: 700;
    }
    .header p {
      color: var(--ff-gray-500, #6b7280); font-size: 14px; margin: 6px 0 0;
    }

    .settings-grid {
      display: grid; grid-template-columns: 1fr 1fr; gap: 24px;
    }

    @media (max-width: 900px) {
      .settings-grid { grid-template-columns: 1fr; }
    }

    .settings-card {
      background: var(--ff-surface); border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1); padding: 24px;
    }
    .settings-card h2 {
      font-size: 18px; color: var(--ff-gray-900, #111827); margin: 0 0 16px; font-weight: 600;
    }

    .info-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid var(--ff-gray-100);
    }
    .info-row:last-child { border-bottom: none; }
    .info-label {
      font-size: 14px; color: var(--ff-gray-500, #6b7280); font-weight: 500;
    }
    .info-value {
      font-size: 14px; color: var(--ff-gray-900, #111827); font-weight: 500;
    }
    .info-value.badge {
      display: inline-block; padding: 2px 10px;
      border-radius: 9999px; font-size: 12px; font-weight: 600;
      background: var(--ff-primary-light, #eef2ff); color: var(--ff-primary, #4f46e5);
    }

    .form-group {
      margin-bottom: 16px;
    }
    label {
      display: block; margin-bottom: 6px; font-weight: 500;
      font-size: 14px; color: var(--ff-gray-700, #374151);
    }
    .form-input {
      width: 100%; padding: 8px 12px; border: 1px solid var(--ff-border);
      border-radius: 6px; font-size: 14px; box-sizing: border-box;
      transition: border-color 0.2s;
    }
    .form-input:focus {
      outline: none; border-color: var(--ff-primary, #4f46e5);
      box-shadow: 0 0 0 3px var(--ff-primary-light);
    }

    .btn {
      padding: 10px 20px; border-radius: 6px; font-size: 14px;
      font-weight: 600; cursor: pointer; transition: all 0.2s; border: none;
    }
    .btn-primary {
      background: var(--ff-primary, #4f46e5); color: #fff;
    }
    .btn-primary:hover { background: var(--ff-primary-hover, #4338ca); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }

    .preference-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 0; border-bottom: 1px solid var(--ff-gray-100);
    }
    .preference-row:last-child { border-bottom: none; }
    .preference-label {
      font-size: 14px; color: var(--ff-gray-900, #111827); font-weight: 500;
    }
    .preference-desc {
      font-size: 12px; color: var(--ff-gray-500, #6b7280); margin-top: 2px;
    }

    .toggle-switch {
      position: relative; width: 44px; height: 24px;
    }
    .toggle-switch input {
      opacity: 0; width: 0; height: 0;
    }
    .toggle-slider {
      position: absolute; cursor: pointer;
      top: 0; left: 0; right: 0; bottom: 0;
      background-color: var(--ff-gray-300); border-radius: 24px;
      transition: 0.3s;
    }
    .toggle-slider:before {
      position: absolute; content: "";
      height: 18px; width: 18px; left: 3px; bottom: 3px;
      background-color: white; border-radius: 50%;
      transition: 0.3s;
    }
    input:checked + .toggle-slider {
      background-color: var(--ff-primary, #4f46e5);
    }
    input:checked + .toggle-slider:before {
      transform: translateX(20px);
    }

    .about-section {
      grid-column: 1 / -1;
    }
    .version-info {
      display: flex; gap: 24px; flex-wrap: wrap;
    }
    .version-item {
      font-size: 14px; color: var(--ff-gray-500, #6b7280);
    }
    .version-item strong {
      color: var(--ff-gray-900, #111827);
    }


  `;

  connectedCallback() {
    super.connectedCallback();
    this._loadPreferences();
    this._loadUser();
  }

  _loadPreferences() {
    try {
      const prefs = JSON.parse(localStorage.getItem('ff_preferences') || '{}');
      this.emailNotifications = prefs.emailNotifications ?? true;
      this.agentWarnings = prefs.agentWarnings ?? true;
      this.weeklyReport = prefs.weeklyReport ?? false;
      this.compactView = prefs.compactView ?? false;
      this.collapseSidebar = prefs.collapseSidebar ?? false;
    } catch { /* ignore */ }
  }

  _savePreference(key: string, value: boolean) {
    (this as any)[key] = value;
    try {
      const prefs = JSON.parse(localStorage.getItem('ff_preferences') || '{}');
      prefs[key] = value;
      localStorage.setItem('ff_preferences', JSON.stringify(prefs));
    } catch { /* ignore */ }
  }

  async _loadUser() {
    try {
      if (isDemoMode()) {
        this.user = getDemoUser();
      } else {
        // Use stored user info from the app
        const stored = localStorage.getItem('user');
        this.user = stored ? JSON.parse(stored) : { email: 'Unbekannt', role: 'user' };
      }
    } catch {
      this.user = { email: 'Unbekannt', role: 'user' };
    } finally {
      this.isLoading = false;
    }
  }

  async _changePassword(e: Event) {
    e.preventDefault();

    if (this.newPassword !== this.confirmPassword) {
      showToast('Neue Passwörter stimmen nicht überein.', 'error');
      return;
    }
    if (this.newPassword.length < 8) {
      showToast('Das neue Passwort muss mindestens 8 Zeichen lang sein.', 'error');
      return;
    }

    this.isSavingPassword = true;
    try {
      await api.changePassword(this.currentPassword, this.newPassword);
      showToast('Passwort erfolgreich geändert!', 'success');
    } catch (err: any) {
      showToast('Fehler: ' + (err?.message || 'Unbekannt'), 'error');
    } finally {
      this.isSavingPassword = false;
      this.currentPassword = '';
      this.newPassword = '';
      this.confirmPassword = '';
    }
  }

  render() {
    if (this.isLoading) {
      return html`<ff-loading-spinner></ff-loading-spinner>`;
    }

    return html`
      <div class="header">
        <h1>Einstellungen</h1>
        <p>Verwalte dein Profil, Sicherheitsoptionen und Anwendungseinstellungen.</p>
      </div>

      <div class="settings-grid">
        <!-- Profile Card -->
        <div class="settings-card">
          <h2>Profil</h2>
          <div class="info-row">
            <span class="info-label">E-Mail</span>
            <span class="info-value">${this.user?.email || '–'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Rolle</span>
            <span class="info-value badge">${this.user?.role || 'user'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Erstellt am</span>
            <span class="info-value">${this.user?.created_at ? new Date(this.user.created_at).toLocaleDateString('de-DE') : '–'}</span>
          </div>
        </div>

        <!-- Password Card -->
        <div class="settings-card">
          <h2>Passwort ändern</h2>
          <form @submit=${this._changePassword}>
            <div class="form-group">
              <label for="current-password">Aktuelles Passwort</label>
              <input type="password" id="current-password" class="form-input" required
                .value=${this.currentPassword}
                @input=${(e: any) => this.currentPassword = e.target.value}>
            </div>
            <div class="form-group">
              <label for="new-password">Neues Passwort</label>
              <input type="password" id="new-password" class="form-input" required minlength="8"
                .value=${this.newPassword}
                @input=${(e: any) => this.newPassword = e.target.value}>
            </div>
            <div class="form-group">
              <label for="confirm-password">Passwort bestätigen</label>
              <input type="password" id="confirm-password" class="form-input" required minlength="8"
                .value=${this.confirmPassword}
                @input=${(e: any) => this.confirmPassword = e.target.value}>
            </div>
            <button type="submit" class="btn btn-primary" ?disabled=${this.isSavingPassword}>
              ${this.isSavingPassword ? 'Wird gespeichert…' : 'Passwort ändern'}
            </button>
          </form>
        </div>

        <!-- Preferences Card -->
        <div class="settings-card">
          <h2>Benachrichtigungen</h2>
          <div class="preference-row">
            <div>
              <div class="preference-label">E-Mail-Benachrichtigungen</div>
              <div class="preference-desc">Benachrichtigungen bei Fehlern und abgeschlossenen Transfers</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.emailNotifications}
                @change=${(e: any) => this._savePreference('emailNotifications', e.target.checked)}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="preference-row">
            <div>
              <div class="preference-label">Agent-Warnungen</div>
              <div class="preference-desc">Benachrichtigungen wenn Agents offline gehen</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.agentWarnings}
                @change=${(e: any) => this._savePreference('agentWarnings', e.target.checked)}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="preference-row">
            <div>
              <div class="preference-label">Wöchentlicher Bericht</div>
              <div class="preference-desc">Zusammenfassung aller Transfers per E-Mail</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.weeklyReport}
                @change=${(e: any) => this._savePreference('weeklyReport', e.target.checked)}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- Appearance Card -->
        <div class="settings-card">
          <h2>Darstellung</h2>
          <div class="preference-row">
            <div>
              <div class="preference-label">Kompakte Ansicht</div>
              <div class="preference-desc">Weniger Abstand zwischen Elementen</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.compactView}
                @change=${(e: any) => this._savePreference('compactView', e.target.checked)}>
              <span class="toggle-slider"></span>
            </label>
          </div>
          <div class="preference-row">
            <div>
              <div class="preference-label">Seitenleiste minimieren</div>
              <div class="preference-desc">Sidebar standardmäßig eingeklappt</div>
            </div>
            <label class="toggle-switch">
              <input type="checkbox" .checked=${this.collapseSidebar}
                @change=${(e: any) => this._savePreference('collapseSidebar', e.target.checked)}>
              <span class="toggle-slider"></span>
            </label>
          </div>
        </div>

        <!-- About Card -->
        <div class="settings-card about-section">
          <h2>Über FileFlux</h2>
          <div class="version-info">
            <div class="version-item"><strong>Version:</strong> 1.0.0-beta</div>
            <div class="version-item"><strong>Backend:</strong> Go 1.22</div>
            <div class="version-item"><strong>Frontend:</strong> Lit 2.6 + TypeScript</div>
            <div class="version-item"><strong>Agent:</strong> Go 1.21</div>
          </div>
        </div>
      </div>
    `;
  }
}
