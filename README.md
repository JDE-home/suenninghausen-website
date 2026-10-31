# Sünninghausen – Dorf-Website

Statische Website (Astro) für Sünninghausen, Ortsteil von Oelde: Termine, Vereine und Links.
Konzept, Recherche und Roadmap: siehe [PLAN.md](PLAN.md).

## Entwickeln

```bash
npm install
npm run dev      # http://localhost:4321
npm run build    # Ausgabe in dist/
```

## Inhalte pflegen

Alle Inhalte liegen als JSON in `src/data/`:

| Datei | Inhalt |
|---|---|
| `events.json` | Termine (`start`, optional `end`, `time`, `club`, `category`) – vergangene Termine verschwinden beim nächsten Build automatisch |
| `clubs.json` | Vereine & Institutionen mit Link (`url`) |
| `categories.json` | Terminkategorien und Farben |
| `links.json` | Nützliche externe Links |

Einträge mit `"demo": true` sind Beispiele und werden als „Beispiel“ markiert. Zum Veröffentlichen: Flag entfernen,
Banner in `src/layouts/Base.astro` löschen, `site` in `astro.config.mjs` auf die echte Domain setzen und
Impressum/Datenschutz ausfüllen.

Der Kalender-Feed `/termine.ics` wird automatisch aus `events.json` erzeugt.
