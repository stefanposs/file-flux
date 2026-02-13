import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { isDemoMode, getDemoUser } from '../../demo-mode';
import { api, ApiRequestError } from '../../services/api-service';

@customElement('ff-login')
export class Login extends LitElement {
    @state() private username = '';
    @state() private password = '';
    @state() private isLoading = false;
    @state() private error: string | null = null;

    static styles = css`
      :host {
        display: block;
        height: 100vh;
        display: flex;
        justify-content: center;
        align-items: center;
        background-color: var(--ff-gray-100);
      }
      
      .login-container {
        background: white;
        padding: 30px;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        width: 350px;
      }
      
      h2 {
        text-align: center;
        color: var(--ff-primary, #4f46e5);
        margin-bottom: 24px;
      }
      
      .form-group {
        margin-bottom: 16px;
      }
      
      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      input {
        width: 100%;
        padding: 10px;
        border: 1px solid var(--ff-border);
        border-radius: 4px;
      }
      
      button {
        width: 100%;
        padding: 12px;
        background-color: var(--ff-primary, #4f46e5);
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
      }
      
      button:disabled {
        background-color: var(--ff-gray-500);
      }
      
      .error {
        color: red;
        margin-bottom: 16px;
      }
      
      .demo-hint {
        margin-top: 20px;
        padding: 10px;
        background-color: var(--ff-gray-50);
        border-radius: 4px;
        font-size: 14px;
      }
    `;

    render() {
      return html`
        <div class="login-container">
          <h2>File Flux Login</h2>
          
          ${this.error ? html`<div class="error">${this.error}</div>` : ''}
          
          <form @submit=${this._handleSubmit}>
            <div class="form-group">
              <label for="username">Benutzername</label>
              <input 
                type="text"
                id="username"
                .value=${this.username}
                @input=${(e: Event) => this.username = (e.target as HTMLInputElement).value}
                ?disabled=${this.isLoading}
                required
              />
            </div>
            
            <div class="form-group">
              <label for="password">Passwort</label>
              <input 
                type="password"
                id="password"
                .value=${this.password}
                @input=${(e: Event) => this.password = (e.target as HTMLInputElement).value}
                ?disabled=${this.isLoading}
                required
              />
            </div>
            
            <button type="submit" ?disabled=${this.isLoading}>
              ${this.isLoading ? 'Anmeldung...' : 'Anmelden'}
            </button>
          </form>
          
          ${isDemoMode() ? html`
            <div class="demo-hint">
              <strong>Demo-Modus:</strong> Verwende
              <div>Benutzername: demo</div>
              <div>Passwort: password</div>
            </div>
          ` : ''}
        </div>
      `;
    }

    async _handleSubmit(e: Event) {
      e.preventDefault();
      
      this.isLoading = true;
      this.error = null;
      
      if (isDemoMode()) {
        setTimeout(() => {
          if (this.username === 'demo' && this.password === 'password') {
            const user = getDemoUser();
            const event = new CustomEvent('login', {
              detail: { success: true, user }
            });
            this.dispatchEvent(event);
          } else {
            this.error = 'Ungültige Anmeldedaten. Verwende demo/password';
            this.isLoading = false;
          }
        }, 1000);
      } else {
        // Try real API
        try {
          const response = await api.login(this.username, this.password);
          this.dispatchEvent(new CustomEvent('login', {
            detail: { success: true, user: response.user }
          }));
        } catch (err) {
          if (err instanceof ApiRequestError && err.status === 401) {
            this.error = 'Ungültige E-Mail oder Passwort';
          } else {
            this.error = 'Server nicht erreichbar';
          }
        } finally {
          this.isLoading = false;
        }
      }
    }
}