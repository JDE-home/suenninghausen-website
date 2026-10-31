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

Produktion: Vercel (siehe „Hosting“) oder `npm run build && npm start` bzw. Docker (`docker compose up -d --build`).
Beim ersten Start werden die Beispieldaten aus `src/data/` übernommen. Bei Vercel liegen die Inhalte in Redis, sonst im Verzeichnis
`DATA_DIR` (Standard `./data`). **Dieses Verzeichnis bzw. die Datenbank sichern** – sie enthalten Termine, Vereine, Verlauf und Benutzer.

### Passwort vergessen?

Bei Dateispeicher `data/users.json` löschen, bei Redis den Schlüssel `sh:users` löschen (Upstash-Konsole), dann mit gesetztem `ADMIN_PASSWORD` neu starten bzw. neu deployen – der Administrator wird neu angelegt.

### Sicherheit

Passwörter werden mit scrypt gespeichert; Anmelde-Cookies sind signiert, `HttpOnly` und `SameSite=Strict`;
jede Änderung braucht ein Token pro Sitzung (CSRF); nach 5 Fehlversuchen wird die Anmeldung 15 Minuten gesperrt;
Eingaben werden serverseitig geprüft und beim Anzeigen maskiert; strikte Content-Security-Policy.
**Im Internet nur über HTTPS betreiben** (Reverse-Proxy oder Hoster-Zertifikat).

### Hosting

Die Seite läuft an zwei Orten, der Speicher passt sich automatisch an:

| Ziel | Speicher | Einrichtung |
|---|---|---|
| **Vercel** | Upstash Redis (kostenloser Tarif reicht) | siehe unten |
| **Docker / VPS** | Dateien in `DATA_DIR` | `docker compose up -d --build` |

**Vercel einrichten (einmalig):**

1. Projekt in Vercel aus dem GitHub-Repository importieren (Framework „Astro“ wird erkannt; der Vercel-Adapter wird beim Build automatisch gewählt).
2. In Vercel unter **Storage → Marketplace → Upstash Redis** eine Datenbank anlegen und mit dem Projekt verbinden. Dabei werden `KV_REST_API_URL` und `KV_REST_API_TOKEN` automatisch gesetzt.
3. Unter **Settings → Environment Variables** `ADMIN_USER` und `ADMIN_PASSWORD` (mind. 10 Zeichen) setzen, optional `SITE_URL` (z. B. `https://suenninghausen.de`).
4. **Redeploy** auslösen. Danach unter `/admin/` anmelden und das Passwort ändern.

Solange kein Redis verbunden ist, zeigt die öffentliche Seite nur die Beispieldaten, und `/admin/` erklärt, was zu tun ist.
Hinweis: Preview-Deployments, die mit derselben Redis-Datenbank verbunden sind, teilen sich die Inhalte mit der Live-Seite.
Gleichzeitiges Speichern durch zwei Administratoren im selben Moment ist nicht abgesichert (der zuletzt gespeicherte Stand gewinnt); der Verlauf erlaubt jederzeit die Wiederherstellung.

### Weitere Inhalte

Kategorien, nützliche Links und Galerie liegen weiterhin als JSON in `src/data/` (`categories.json`, `links.json`, `gallery.json`);
Fotos kommen nach `src/assets/photos/` (siehe dortige README).

### Tests

```bash
npm test     # baut die Seite und prüft Login, Rechte, CSRF, Termine, Serien, Verlauf, Sperre …
             # jeweils mit Dateispeicher und mit (simuliertem) Redis, plus Vercel ohne Speicher
```
