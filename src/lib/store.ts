// Inhalte (Termine, Vereine) mit Versionsverlauf. Jede Änderung wird als Schnappschuss gespeichert.
// Schlüssel: "content" (aktueller Stand), "history:index" (Liste), "history:snap:<datei>" (Schnappschüsse).
import { backend, storageMissing } from './backend';
import seedEvents from '../data/events.json';
import seedClubs from '../data/clubs.json';
import type { Club, VillageEvent } from './data';

export { dataDir } from './backend';
export type Content = { events: VillageEvent[]; clubs: Club[] };
export type HistoryEntry = { file: string; at: string; by: string; summary: string };

const MAX_HISTORY = 100;
// Redis-Zugriffe sind Netzwerkaufrufe: Lesezugriffe kurz zwischenspeichern (Änderungen sind nach ≤ 2 s überall sichtbar).
const CACHE_MS = () => (backend().kind === 'redis' ? 2000 : 0);

let cache: { at: number; content: Content } | null = null;
let queue: Promise<unknown> = Promise.resolve();
const serialize = <T>(fn: () => Promise<T>): Promise<T> => {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
};

const parse = <T>(raw: string | null): T | null => { try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; } };

async function readContent(): Promise<Content | null> {
  const c = parse<Content>(await backend().get('content'));
  return c && Array.isArray(c.events) && Array.isArray(c.clubs) ? c : null;
}

/** Aktuelle Inhalte; beim ersten Start werden die Beispieldaten aus src/data übernommen. */
const seed = (): Content => ({ events: seedEvents as VillageEvent[], clubs: seedClubs as Club[] });

export async function getContent(): Promise<Content> {
  // Vercel ohne verbundenen Speicher: nur lesen, Beispieldaten anzeigen (die Verwaltung zeigt eine Einrichtungs-Hilfe).
  if (storageMissing()) return seed();
  if (cache && Date.now() - cache.at < CACHE_MS()) return cache.content;
  let content = await readContent();
  if (!content) {
    content = await serialize(async () => {
      const again = await readContent();
      if (again) return again;
      const initial = seed();
      await backend().set('content', JSON.stringify(initial));
      await writeHistory(initial, 'system', 'Beispieldaten angelegt');
      return initial;
    });
  }
  cache = { at: Date.now(), content };
  return content;
}

async function readIndex(): Promise<HistoryEntry[]> {
  return parse<HistoryEntry[]>(await backend().get('history:index')) ?? [];
}

async function writeHistory(content: Content, by: string, summary: string) {
  const at = new Date().toISOString();
  const file = `${at.replace(/[:.]/g, '-')}-${crypto.randomUUID().slice(0, 4)}`;
  await backend().set(`history:snap:${file}`, JSON.stringify({ content }));
  const index = [{ file, at, by, summary }, ...(await readIndex())];
  for (const old of index.slice(MAX_HISTORY)) await backend().del(`history:snap:${old.file}`);
  await backend().set('history:index', JSON.stringify(index.slice(0, MAX_HISTORY)));
}

/** Ändert die Inhalte. `mutate` bekommt eine Kopie und gibt den neuen Stand zurück. */
export function updateContent(by: string, summary: string, mutate: (c: Content) => Content | void): Promise<Content> {
  return serialize(async () => {
    const current = structuredClone((await readContent()) ?? (await getContent()));
    const next = mutate(current) ?? current;
    await backend().set('content', JSON.stringify(next));
    cache = { at: Date.now(), content: next };
    await writeHistory(next, by, summary);
    return next;
  });
}

export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  await getContent();
  return (await readIndex()).slice(0, limit);
}

/** Stellt einen früheren Stand wieder her (wird selbst wieder als Änderung protokolliert). */
export async function restoreHistory(file: string, by: string): Promise<boolean> {
  const entry = (await readIndex()).find((e) => e.file === file); // nur bekannte Einträge → keine Pfad-Tricks
  if (!entry) return false;
  const snap = parse<{ content: Content }>(await backend().get(`history:snap:${entry.file}`));
  if (!snap || !Array.isArray(snap.content?.events) || !Array.isArray(snap.content?.clubs)) return false;
  await updateContent(by, `Stand vom ${entry.at.slice(0, 16).replace('T', ' ')} wiederhergestellt`, () => snap.content);
  return true;
}
