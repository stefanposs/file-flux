# File Flux - Moderne Dateiaustauschplattform

File Flux ist eine leistungsstarke und benutzerfreundliche Plattform für sicheren Dateiaustausch zwischen Servern und Systemen. Mit einem flexiblen Agenten-System ermöglicht File Flux automatisierte Uploads und Downloads mit umfassender Überwachung.

## Funktionen

- **Dashboard** mit Echtzeit-Statistiken und aktuellen Transfers
- **Job-Management** für automatisierte wiederkehrende Transfers
- **Agent-Verwaltung** für Upload- und Download-Knotenpunkte
- **Token-Verwaltung** für sichere Authentifizierung
- **Transfer-Überwachung** mit detaillierten Protokollen
- **Responsive Benutzeroberfläche** für Desktop und Mobile

## Erste Schritte

### Voraussetzungen

- Node.js (v14 oder höher)
- npm (v6 oder höher)

### Installation

```bash
# Repository klonen
git clone https://github.com/your-username/file-flux.git
cd file-flux

# Frontend-Abhängigkeiten installieren
cd frontend
npm install
```

### Entwicklungsserver starten

```bash
# Im frontend-Verzeichnis
npm run dev
```

Dies startet einen lokalen Entwicklungsserver, normalerweise unter `http://localhost:3000`.

### Demo-Modus

File Flux bietet einen Demo-Modus, der ohne Backend funktioniert und vordefinierte Beispieldaten verwendet.

Um den Demo-Modus zu aktivieren:
1. Starte den Entwicklungsserver wie oben beschrieben
2. Öffne die Anwendung im Browser mit dem Parameter `?demo=true`:
   ```
   http://localhost:3000/?demo=true
   ```

Im Demo-Modus kannst du alle Funktionen der Anwendung erkunden, ohne ein Backend einrichten zu müssen. Alle Aktionen wie Erstellen, Bearbeiten oder Löschen werden simuliert.

### Produktions-Build erstellen

```bash
# Im frontend-Verzeichnis
npm run build
```

Die kompilierten Dateien werden im `dist`-Verzeichnis abgelegt und können auf einem Webserver bereitgestellt werden.

## Projektstruktur
