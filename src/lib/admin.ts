export const MESSAGES: Record<string, string> = {
  saved: 'Gespeichert. Die Änderung ist sofort auf der Website sichtbar.',
  created: 'Termin angelegt. Er ist sofort auf der Website sichtbar.',
  deleted: 'Gelöscht.',
  copied: 'Kopie angelegt – bitte Datum und Details anpassen.',
  purged: 'Alle Beispieleinträge wurden entfernt.',
  restored: 'Früherer Stand wiederhergestellt.',
  password: 'Passwort geändert.',
  notfound: 'Eintrag nicht gefunden.',
  inuse: 'Dieser Verein hat noch Termine. Bitte zuerst die Termine löschen oder einem anderen Verein zuordnen.',
  loggedout: 'Sie wurden abgemeldet.',
};

/** Bestätigungstext aus ?m=… (nur bekannte Codes) – optional mit Anzahl ?n=… */
export function flash(url: URL): string | null {
  const m = MESSAGES[url.searchParams.get('m') ?? ''];
  if (!m) return null;
  const n = Number(url.searchParams.get('n'));
  return url.searchParams.get('m') === 'created' && n > 1 ? `${n} Termine angelegt. Sie sind sofort auf der Website sichtbar.` : m;
}

export const isHttps = (req: Request, url: URL) => url.protocol === 'https:' || req.headers.get('x-forwarded-proto') === 'https';
