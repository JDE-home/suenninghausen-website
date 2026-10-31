// Serverseitige Prüfung der Formulare (die Browser-Prüfung ist nur Komfort).
import type { Category, Club, VillageEvent } from './data';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
const validDate = (s: string) => ISO.test(s) && !Number.isNaN(Date.parse(`${s}T12:00:00Z`)) && new Date(`${s}T12:00:00Z`).toISOString().startsWith(s);
const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);

export type Result<T> = { ok: true; value: T } | { ok: false; errors: Record<string, string> };

export function parseEvent(f: FormData, clubs: Club[], categories: Category[], existing?: VillageEvent): Result<VillageEvent> {
  const errors: Record<string, string> = {};
  const title = str(f, 'title', 120);
  const start = str(f, 'start', 10);
  const end = str(f, 'end', 10);
  const timeRaw = str(f, 'time', 5);
  const location = str(f, 'location', 120);
  const description = str(f, 'description', 600);
  const club = str(f, 'club', 60);
  const category = str(f, 'category', 60);

  if (!title) errors.title = 'Bitte einen Titel eingeben.';
  if (!validDate(start)) errors.start = 'Bitte ein gültiges Datum wählen.';
  if (end && !validDate(end)) errors.end = 'Das Enddatum ist ungültig.';
  else if (end && validDate(start) && end < start) errors.end = 'Das Ende darf nicht vor dem Beginn liegen.';
  if (timeRaw && !/^([01]\d|2[0-3]):[0-5]\d$/.test(timeRaw)) errors.time = 'Bitte eine Uhrzeit wie 19:30 angeben.';
  if (!location) errors.location = 'Bitte einen Ort angeben.';
  if (!clubs.some((c) => c.id === club)) errors.club = 'Bitte einen Veranstalter wählen.';
  if (!categories.some((c) => c.id === category)) errors.category = 'Bitte eine Kategorie wählen.';
  if (Object.keys(errors).length) return { ok: false, errors };

  const time = timeRaw ? (f.get('ab') ? `ab ${timeRaw}` : timeRaw) : undefined;
  const value: VillageEvent = {
    id: existing?.id ?? newId(title, start),
    title, start, ...(end && end !== start ? { end } : {}), ...(time ? { time } : {}),
    location, club, category, description,
    demo: !!f.get('demo'),
    ...(existing?.note ? { note: existing.note } : {}),
  };
  return { ok: true, value };
}

export function parseClub(f: FormData, existing?: Club): Result<Club> {
  const errors: Record<string, string> = {};
  const name = str(f, 'name', 100);
  const kind = str(f, 'kind', 40) || 'Verein';
  const description = str(f, 'description', 400);
  const url = str(f, 'url', 300);
  const icon = str(f, 'icon', 8) || '🏡';
  if (!name) errors.name = 'Bitte einen Namen eingeben.';
  if (url) {
    try { if (!/^https?:$/.test(new URL(url).protocol)) throw 0; } catch { errors.url = 'Bitte eine vollständige Adresse mit https:// angeben.'; }
  }
  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { id: existing?.id ?? newId(name), name, kind, description, url: url || null, icon, demo: !!f.get('demo'), ...(existing?.note ? { note: existing.note } : {}) } };
}

const slug = (s: string) => s.toLowerCase().replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const newId = (title: string, date = '') => `${slug(title) || 'eintrag'}-${date}-${crypto.randomUUID().slice(0, 4)}`.replace(/-+/g, '-');

/** Serie: wöchentlich / alle 2 Wochen / monatlich bis Enddatum (max. 60 Termine). */
export function expandSeries(base: VillageEvent, repeat: string, until: string): VillageEvent[] {
  if (!['weekly', 'biweekly', 'monthly'].includes(repeat) || !validDate(until)) return [base];
  const out: VillageEvent[] = [];
  const span = base.end ? (Date.parse(base.end) - Date.parse(base.start)) / 86400000 : 0;
  for (let i = 0; i < 60; i++) {
    const d = new Date(`${base.start}T12:00:00Z`);
    if (repeat === 'monthly') d.setUTCMonth(d.getUTCMonth() + i); else d.setUTCDate(d.getUTCDate() + i * (repeat === 'weekly' ? 7 : 14));
    const start = d.toISOString().slice(0, 10);
    if (start > until) break;
    const e = new Date(d); e.setUTCDate(e.getUTCDate() + span);
    out.push({ ...base, id: newId(base.title, start), start, ...(span ? { end: e.toISOString().slice(0, 10) } : {}) });
  }
  return out.length ? out : [base];
}
