---
title: "Settings"
weight: 10
---
# Settings

Die Einstellungsseite ermöglicht Benutzern, ihr Konto und Profil zu verwalten.

## Zugriff

Klicken Sie auf das **Zahnrad-Symbol** in der Sidebar oder navigieren Sie direkt zu `/settings`.

---

## Passwort ändern

1. Öffnen Sie die Einstellungsseite
2. Geben Sie Ihr **aktuelles Passwort** ein
3. Geben Sie das **neue Passwort** ein und bestätigen Sie es
4. Klicken Sie auf **Passwort ändern**

!!! info "API-Endpunkt"
    Das Passwort wird über `POST /auth/password` geändert.
    Das alte Passwort muss zur Verifizierung mitgesendet werden.

!!! warning "Standard-Passwort"
    Der initiale Admin-Account verwendet `admin123`.
    Ändern Sie dieses Passwort sofort nach der Installation.

---

## Profil-Informationen

Die Einstellungsseite zeigt:

| Feld | Beschreibung |
|------|-------------|
| **E-Mail** | Anmelde-E-Mail-Adresse (derzeit nicht änderbar) |
| **Rolle** | `admin` oder `user` |
| **Erstellt am** | Datum der Kontoerstellung |

---

## Nächste Schritte

- [Dashboard](dashboard.md) — Zurück zur Übersicht
- [Security](security.md) — Sicherheitsarchitektur verstehen
- [Tokens](tokens.md) — API-Token verwalten
