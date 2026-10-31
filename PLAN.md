# Plan: Dorf-Website Sünninghausen

Sünninghausen ist ein Ortsteil von Oelde (Kreis Warendorf, Münsterland), ca. 7 km südlich der Kernstadt.
Die Seite soll vor allem **Termine** bündeln und zu den **Websites der Vereine** weiterleiten.

## 1. Was wir über Sünninghausen wissen (Recherche)

| Fakt | Quelle / Status |
|---|---|
| Ortsteil von Oelde, ca. 7 km südlich der Kernstadt | Stadtplan Oelde, GenWiki – belegt |
| Erste Erwähnung 890 im Urbar des Klosters Werden | GenWiki – belegt |
| Eingemeindung nach Oelde am 1.1.1970 (zusammen mit Lette und Kirchspiel Oelde) | GenWiki – belegt |
| Katholische Pfarrkirche St. Vitus, Nordkamp 7 | Gelbe Seiten / Pfarrei – belegt |
| Einziger Karnevalsumzug Oeldes findet in Sünninghausen am Karnevalssonntag statt (2027: 7. Februar) | Stadt Oelde – belegt |
| Heimatverein Sünninghausen 1982 e.V. | Heimatforschung Westfalen (Stand 2007) – Status ungeprüft |
| Schützenverein Sünninghausen, Schützenfest im Sommer | Blog Seniorenwohngemeinschaft 2018 – belegt |
| Einwohnerzahl ca. 1.265 | undatiert – ungeprüft |

**Nicht gefunden:** eine eigene Dorf-Website, konkrete aktuelle Termine, Kontaktdaten und URLs der Vereine.
Alles Weitere in `src/data/` ist daher **Beispielinhalt** und mit `"demo": true` markiert.
Die Seite zeigt solange einen sichtbaren Hinweis, bis die echten Daten eingetragen sind.

## 2. Ziele

1. Besucher sehen in 5 Sekunden: *Was ist als Nächstes im Dorf los?*
2. Alle Termine an einem Ort, filterbar nach Kategorie, abonnierbar als Kalender (`.ics`).
3. Jeder Verein hat eine Karte mit Beschreibung und Link zur eigenen Website.
4. Vereine/Ehrenamtliche sollen **ohne Programmierkenntnisse** Termine pflegen können.
5. Sehr geringe Betriebskosten, kein Server zu warten, DSGVO-freundlich (keine Tracker, keine externen Fonts/CDNs).

## 3. Technologie-Entscheidung

**Astro (statische Website) + JSON-Dateien als Datenquelle. Kein klassisches Backend.**

Begründung: Eine Dorfseite ändert sich selten und hat kaum dynamische Logik. Statisches HTML ist schnell,
sicher (keine Datenbank/kein Login-Angriffspunkt), kostenlos hostbar (Vercel, Netlify, GitHub Pages)
und barrierearm. Interaktivität (Filter) läuft mit ~40 Zeilen Vanilla-JS.

| Schicht | Wahl | Alternative, falls nötig |
|---|---|---|
| Frontend | Astro, eigenes CSS (keine Frameworks) | – |
| Daten | `src/data/*.json` (Termine, Vereine, Dorf-Infos) | später Decap CMS / Markdown |
| „Backend" | Build-Time-Generierung (iCal-Feed, sortierte Termine) | Serverless-Function fürs Kontaktformular |
| Pflege | Phase 2: Decap CMS (Git-basiert, Web-Oberfläche) | Formular „Termin melden" |
| Hosting | Vercel/Netlify, Domain z. B. `suenninghausen.de` | – |

## 4. Informationsarchitektur

- `/` Startseite: Hero, nächste Termine, Vereinsübersicht, Dorf-Kurzporträt
- `/termine/` Alle Termine, Filter nach Kategorie, Kalender-Abo
- `/termine.ics` iCal-Feed (für Handy-Kalender)
- `/vereine/` Vereine & Institutionen mit Links
- `/dorf/` Über Sünninghausen: Geschichte, Zahlen, nützliche Links (Stadt Oelde, Kreis)
- `/impressum/` und `/datenschutz/` (Pflicht; Vorlagen, Inhalte vom Betreiber zu ergänzen)

## 5. Umsetzungsphasen

**Phase 1 – Grundgerüst (erledigt in diesem Schritt)**
Projekt-Setup, Layout, Design, Startseite, Termine, Vereine, Dorf, iCal, Beispieldaten.

**Phase 2 – Echte Inhalte**
Vereine anschreiben, echte Termine/URLs/Kontakte sammeln, Fotos, `demo`-Flags entfernen,
Impressum/Datenschutz ausfüllen (Verantwortlichen festlegen).

**Phase 3 – Pflege durch Dritte**
Decap CMS oder „Termin einreichen"-Formular mit Freigabe durch Redaktion; Deploy bei jeder Änderung automatisch.

**Phase 4 – Extras (optional)**
Terminserien (Wiederholungen), Newsletter/Messenger-Kanal, Karte, Fotogalerie, Müllabfuhr-Kalender,
Suche, Mehrsprachigkeit.

## 6. Offene Fragen an die Auftraggeber

1. Wer ist verantwortlich/Betreiber (Impressum)? Verein, Ortsvorsteher, Privatperson?
2. Welche Vereine sollen aufgenommen werden, und gibt es schon Websites?
3. Wer pflegt Termine – eine Person oder jeder Verein selbst?
4. Wunsch-Domain und Farben/Wappen/Logo vorhanden?
