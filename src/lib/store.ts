// Dateibasierter Speicher: data/content.json (aktueller Stand) + data/history/*.json (jede Änderung als Schnappschuss).
// Schreibzugriffe laufen nacheinander und atomar (tmp-Datei + rename), damit nichts halb geschrieben wird.
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from './env';
import seedEvents from '../data/events.json';
import seedClubs from '../data/clubs.json';
import type { Club, VillageEvent } from './data';

export type Content = { events: VillageEvent[]; clubs: Club[] };
export type HistoryEntry = { file: string; at: string; by: string; summary: string };

export const dataDir = () => path.resolve(env('DATA_DIR') ?? 'data');
const contentFile = () => path.join(dataDir(), 'content.json');
const historyDir = () => path.join(dataDir(), 'history');
const MAX_HISTORY = 200;

let cache: { mtime: number; content: Content } | null = null;
let queue: Promise<unknown> = Promise.resolve();

const exists = (p: string) => fs.access(p).then(() => true, () => false);

async function atomicWrite(file: string, data: string) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tmp, data, { encoding: 'utf8', mode: 0o600 });
  await fs.rename(tmp, file);
}

/** Aktuelle Inhalte; beim ersten Start werden die Beispieldaten aus src/data übernommen. */
export async function getContent(): Promise<Content> {
  const file = contentFile();
  if (!(await exists(file))) {
    await serialize(async () => {
      if (!(await exists(file))) {
        const seed: Content = { events: seedEvents as VillageEvent[], clubs: seedClubs as Club[] };
        await atomicWrite(file, JSON.stringify(seed, null, 2));
        await writeHistory(seed, 'system', 'Beispieldaten angelegt');
      }
    });
  }
  const { mtimeMs } = await fs.stat(file);
  if (cache && cache.mtime === mtimeMs) return cache.content;
  const content = JSON.parse(await fs.readFile(file, 'utf8')) as Content;
  cache = { mtime: mtimeMs, content };
  return content;
}

function serialize<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function writeHistory(content: Content, by: string, summary: string) {
  const at = new Date().toISOString();
  const file = `${at.replace(/[:.]/g, '-')}.json`;
  await atomicWrite(path.join(historyDir(), file), JSON.stringify({ at, by, summary, content }));
  const files = (await fs.readdir(historyDir())).filter((f) => f.endsWith('.json')).sort();
  for (const old of files.slice(0, Math.max(0, files.length - MAX_HISTORY))) {
    await fs.unlink(path.join(historyDir(), old)).catch(() => undefined);
  }
}

/** Ändert die Inhalte atomar. `mutate` bekommt eine Kopie und gibt den neuen Stand zurück. */
export function updateContent(by: string, summary: string, mutate: (c: Content) => Content | void): Promise<Content> {
  return serialize(async () => {
    const current = structuredClone(await getContent());
    const next = mutate(current) ?? current;
    await atomicWrite(contentFile(), JSON.stringify(next, null, 2));
    cache = null;
    await writeHistory(next, by, summary);
    return next;
  });
}

export async function listHistory(limit = 50): Promise<HistoryEntry[]> {
  await getContent();
  const files = (await fs.readdir(historyDir())).filter((f) => f.endsWith('.json')).sort().reverse().slice(0, limit);
  const out: HistoryEntry[] = [];
  for (const file of files) {
    try {
      const { at, by, summary } = JSON.parse(await fs.readFile(path.join(historyDir(), file), 'utf8'));
      out.push({ file, at, by, summary });
    } catch { /* defekte Datei überspringen */ }
  }
  return out;
}

/** Stellt einen früheren Stand wieder her (wird selbst wieder als Änderung protokolliert). */
export async function restoreHistory(file: string, by: string): Promise<boolean> {
  if (!/^[0-9TZ-]+\.json$/.test(file)) return false;
  try {
    const snap = JSON.parse(await fs.readFile(path.join(historyDir(), file), 'utf8'));
    if (!Array.isArray(snap?.content?.events) || !Array.isArray(snap?.content?.clubs)) return false;
    await updateContent(by, `Stand vom ${snap.at.slice(0, 16).replace('T', ' ')} wiederhergestellt`, () => snap.content as Content);
    return true;
  } catch {
    return false;
  }
}
