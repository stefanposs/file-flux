import { LitElement, html, css } from 'lit';

class TestApp extends LitElement {
  static styles = css`
    :host { display: block; padding: 20px; }
    h1 { color: blue; }
  `;

  render() {
    return html`
      <h1>Test App Works!</h1>
      <p>Wenn du diese Nachricht siehst, funktioniert Lit.js korrekt.</p>
    `;
  }
}

customElements.define('test-app', TestApp);

document.getElementById('app').innerHTML = '<test-app></test-app>'; 