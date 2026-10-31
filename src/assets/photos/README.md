# Dorffotos

Echte Fotos hier ablegen (JPG/PNG/WebP, möglichst max. 1600 px breit) und in `src/data/gallery.json`
beim passenden Eintrag eintragen:

```json
{ "id": "kirche", "scene": "kirche", "title": "St. Vitus", "caption": "…",
  "photo": "kirche-st-vitus.jpg", "credit": "Foto: Vorname Nachname, CC BY-SA 4.0" }
```

Sobald `photo` gesetzt ist und die Datei existiert, ersetzt das Foto automatisch die Illustration.
**Nur Fotos verwenden, deren Nutzung erlaubt ist** (eigene Fotos, Genehmigung des Fotografen oder freie Lizenz mit
korrekter Namensnennung). `credit` wird unter dem Bild angezeigt.
