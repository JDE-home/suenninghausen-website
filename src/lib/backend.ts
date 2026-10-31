// Speicher-Schicht: kleine Schlüssel/Wert-Schnittstelle mit zwei Umsetzungen.
//  • Redis (Upstash, per REST) – für Vercel & Co. ohne dauerhaftes Dateisystem
//  • Dateien in DATA_DIR       – für Docker/VPS und lokale Entwicklung
// Gewählt wird automatisch über Umgebungsvariablen (siehe .env.example).
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { env } from './env';

export interface Backend {
  readonly kind: 'redis' | 'file';
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  del(key: string): Promise<void>;
}

// ---- Redis über die REST-Schnittstelle (Upstash / Vercel Marketplace) -------
const redisConfig = () => {
  const url = env('KV_REST_API_URL') ?? env('UPSTASH_REDIS_REST_URL');
  const token = env('KV_REST_API_TOKEN') ?? env('UPSTASH_REDIS_REST_TOKEN');
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
};

function redisBackend(cfg: { url: string; token: string }): Backend {
  const cmd = async (...args: string[]): Promise<unknown> => {
    const res = await fetch(cfg.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    const body = (await res.json().catch(() => ({}))) as { result?: unknown; error?: string };
    if (!res.ok || body.error) throw new Error(`Redis-Fehler (${res.status}): ${body.error ?? 'unbekannt'}`);
    return body.result;
  };
  const k = (key: string) => `sh:${key}`;
  return {
    kind: 'redis',
    get: async (key) => ((await cmd('GET', k(key))) as string | null) ?? null,
    set: async (key, value) => { await cmd('SET', k(key), value); },
    del: async (key) => { await cmd('DEL', k(key)); },
  };
}

// ---- Dateien --------------------------------------------------------------
export const dataDir = () => path.resolve(env('DATA_DIR') ?? 'data');

function fileBackend(): Backend {
  // "content" → data/content.json, "history:snap:x" → data/history/snap/x.json
  const file = (key: string) => path.join(dataDir(), ...key.split(':')) + '.json';
  return {
    kind: 'file',
    async get(key) {
      try { return await fs.readFile(file(key), 'utf8'); } catch { return null; }
    },
    async set(key, value) {
      const target = file(key);
      await fs.mkdir(path.dirname(target), { recursive: true });
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, value, { encoding: 'utf8', mode: 0o600 });
      await fs.rename(tmp, target); // atomar: nie eine halb geschriebene Datei
    },
    async del(key) { await fs.unlink(file(key)).catch(() => undefined); },
  };
}

/** Auf Vercel gibt es kein dauerhaftes Dateisystem – dort ist Redis Pflicht. */
export const storageMissing = () => !!env('VERCEL') && !redisConfig();

let selected: Backend | null = null;
export function backend(): Backend {
  if (selected) return selected;
  const cfg = redisConfig();
  selected = cfg ? redisBackend(cfg) : fileBackend();
  return selected;
}
