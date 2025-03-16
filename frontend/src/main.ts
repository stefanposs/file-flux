// Keine manuelle Definition nötig - die Komponenten werden durch @customElement registriert
import './app';

// Anwendung im DOM mounten
document.addEventListener('DOMContentLoaded', () => {
  const appContainer = document.getElementById('app');
  if (appContainer) {
    const app = document.createElement('file-flux-app');
    appContainer.appendChild(app);
  } else {
    console.error('App-Container nicht gefunden!');
  }
}); 