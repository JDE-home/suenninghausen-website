# Sünninghausen – Dorf-Website

Statische Website (Astro) für Sünninghausen, Ortsteil von Oelde: Termine, Vereine und Links.
Konzept, Recherche und Roadmap: siehe [PLAN.md](PLAN.md).

## Entwickeln

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # Ausgabe in dist/
```

## Inhalte pflegen (Verwaltung)

Termine und Vereine werden im Browser unter **`/admin/`** gepflegt – ohne Programmierkenntnisse, ohne neuen Build.
Jede Änderung ist sofort auf der Website sichtbar.

| Bereich | Was geht |
|---|---|
| **Termine** | anlegen, ändern, löschen, kopieren (als Vorlage), Serien („jede Woche bis …“), mehrtägige Termine |
| **Vereine** | anlegen, ändern, löschen (mit Link zur Vereins-Website) |
| **Verlauf** | jede Änderung wird protokolliert – früheren Stand mit einem Klick wiederherstellen |
| **Passwort** | eigenes Passwort ändern (meldet andere Geräte ab) |
| **Beispieleinträge entfernen** | löscht alle als „Beispiel“ markierten Einträge, bevor die Seite live geht |

Der Kalender-Feed `/termine.ics` wird automatisch aus den Terminen erzeugt.

### Starten

```bash
npm install
cp .env.example .env     # ADMIN_USER / ADMIN_PASSWORD eintragen (mind. 10 Zeichen)
npm run dev              # http://localhost:4321  →  Verwaltung: /admin/
```

Produktion: `npm run build && npm start` oder per Docker (`docker compose up -d --build`, siehe `docker-compose.yml`).
Beim ersten Start werden die Beispieldaten aus `src/data/` übernommen; danach liegen alle Inhalte im Verzeichnis
`DATA_DIR` (Standard `./data`). **Dieses Verzeichnis regelmäßig sichern** – es enthält Termine, Vereine, Verlauf und Benutzer.

### Passwort vergessen?

`data/users.json` löschen und den Server mit gesetztem `ADMIN_PASSWORD` neu starten – der Administrator wird neu angelegt.

### Sicherheit

Passwörter werden mit scrypt gespeichert; Anmelde-Cookies sind signiert, `HttpOnly` und `SameSite=Strict`;
jede Änderung braucht ein Token pro Sitzung (CSRF); nach 5 Fehlversuchen wird die Anmeldung 15 Minuten gesperrt;
Eingaben werden serverseitig geprüft und beim Anzeigen maskiert; strikte Content-Security-Policy.
**Im Internet nur über HTTPS betreiben** (Reverse-Proxy oder Hoster-Zertifikat).

### Hosting

Die Seite braucht einen Node-Server mit dauerhaftem Speicher (kleiner VPS, Docker-Host, Railway/Fly.io/Render mit Volume).
Reine „Serverless“-Hoster (Vercel, Netlify) eignen sich dafür **nicht**, weil dort keine Dateien dauerhaft gespeichert werden.

### Weitere Inhalte

Kategorien, nützliche Links und Galerie liegen weiterhin als JSON in `src/data/` (`categories.json`, `links.json`, `gallery.json`);
Fotos kommen nach `src/assets/photos/` (siehe dortige README).

### Tests

```bash
npm test     # baut die Seite und prüft Login, Rechte, CSRF, Termine, Serien, Verlauf, Sperre …
```
