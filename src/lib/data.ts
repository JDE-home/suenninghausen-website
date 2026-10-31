import eventsRaw from '../data/events.json';
import clubsRaw from '../data/clubs.json';
import categoriesRaw from '../data/categories.json';
import linksRaw from '../data/links.json';

export type Category = { id: string; label: string; color: string };
export type Club = {
  id: string; name: string; kind: string; description: string;
  url: string | null; icon: string; demo: boolean; note?: string;
};
export type VillageEvent = {
  id: string; title: string; start: string; end?: string; time?: string;
  location: string; club: string; category: string; description: string;
  demo: boolean; note?: string;
};

export const categories = categoriesRaw as Category[];
export const clubs = clubsRaw as Club[];
export const links = linksRaw as { name: string; description: string; url: string }[];

const catMap = new Map(categories.map((c) => [c.id, c]));
const clubMap = new Map(clubs.map((c) => [c.id, c]));
export const getCategory = (id: string) => catMap.get(id)!;
export const getClub = (id: string) => clubMap.get(id)!;

/** Heutiges Datum (YYYY-MM-DD) in Berliner Zeit – Build-Zeitpunkt. */
const today = () =>
  new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());

const all = (eventsRaw as VillageEvent[]).sort((a, b) => a.start.localeCompare(b.start));

/** Nur kommende (bzw. laufende) Termine, sortiert. */
export const upcomingEvents = (): VillageEvent[] => {
  const t = today();
  return all.filter((e) => (e.end ?? e.start) >= t);
};

const parse = (d: string) => new Date(`${d}T12:00:00`);
const fmt = (d: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', ...o }).format(parse(d));

export const dateParts = (e: VillageEvent) => ({
  day: fmt(e.start, { day: '2-digit' }),
  month: fmt(e.start, { month: 'short' }).replace('.', ''),
  weekday: fmt(e.start, { weekday: 'long' }),
  long: e.end
    ? `${fmt(e.start, { weekday: 'short', day: 'numeric', month: 'long' })} – ${fmt(e.end, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })}`
    : fmt(e.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
});

export const monthKey = (e: VillageEvent) => e.start.slice(0, 7);
export const monthLabel = (key: string) => fmt(`${key}-01`, { month: 'long', year: 'numeric' });

/** iCalendar (RFC 5545) – ganztägige Einträge, Uhrzeit steht in der Beschreibung. */
export const toIcs = (events: VillageEvent[], site: string): string => {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
  const ymd = (d: string) => d.replaceAll('-', '');
  const next = (d: string) => { const x = parse(d); x.setDate(x.getDate() + 1); return x.toISOString().slice(0, 10); };
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Sünninghausen//Dorfkalender//DE',
    'CALSCALE:GREGORIAN', 'X-WR-CALNAME:Sünninghausen Dorfkalender', 'X-WR-TIMEZONE:Europe/Berlin',
  ];
  for (const e of events) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${e.id}@${new URL(site).hostname}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(e.start)}`,
      `DTEND;VALUE=DATE:${ymd(next(e.end ?? e.start))}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(`${e.time ? `Beginn: ${e.time}. ` : ''}${e.description} (${getClub(e.club).name})`)}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
};
