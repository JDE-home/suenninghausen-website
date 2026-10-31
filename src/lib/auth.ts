// Anmeldung: scrypt-Passwort-Hashes, signierte Session-Cookies, CSRF-Token, Login-Sperre.
import crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import { dataDir } from './store';
import { env } from './env';

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export type User = { id: string; name: string; hash: string; ver: number };
export const SESSION_COOKIE = 'sh_admin';
export const SESSION_HOURS = 12;
export const MIN_PASSWORD = 10;

const usersFile = () => path.join(dataDir(), 'users.json');
let usersQueue: Promise<unknown> = Promise.resolve();

export async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString('base64')}$${key.toString('base64')}`;
}

export async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [alg, saltB64, keyB64] = stored.split('$');
  if (alg !== 'scrypt' || !saltB64 || !keyB64) return false;
  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(pw, Buffer.from(saltB64, 'base64'), expected.length);
  return crypto.timingSafeEqual(actual, expected);
}

async function readUsers(): Promise<User[]> {
  try { return JSON.parse(await fs.readFile(usersFile(), 'utf8')) as User[]; } catch { return []; }
}
async function writeUsers(users: User[]) {
  await fs.mkdir(dataDir(), { recursive: true });
  const tmp = `${usersFile()}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(users, null, 2), { mode: 0o600 });
  await fs.rename(tmp, usersFile());
}
const lockedUsers = <T>(fn: () => Promise<T>) => { const r = usersQueue.then(fn, fn); usersQueue = r.catch(() => undefined); return r; };

/** Legt beim ersten Start den Administrator aus ADMIN_USER/ADMIN_PASSWORD an (falls noch keiner existiert). */
export async function ensureAdmin(): Promise<'ok' | 'setup-needed'> {
  return lockedUsers(async () => {
    const users = await readUsers();
    if (users.length) return 'ok';
    const pw = env('ADMIN_PASSWORD');
    if (!pw || pw.length < MIN_PASSWORD) return 'setup-needed';
    await writeUsers([{ id: crypto.randomUUID(), name: env('ADMIN_USER') ?? 'admin', hash: await hashPassword(pw), ver: 1 }]);
    return 'ok';
  });
}

export const findUserByName = async (name: string) => (await readUsers()).find((u) => u.name.toLowerCase() === name.toLowerCase());
export const findUserById = async (id: string) => (await readUsers()).find((u) => u.id === id);

export const setPassword = (id: string, pw: string) =>
  lockedUsers(async () => {
    const users = await readUsers();
    const u = users.find((x) => x.id === id);
    if (!u) return false;
    u.hash = await hashPassword(pw);
    u.ver += 1; // macht alle bestehenden Sitzungen ungültig
    await writeUsers(users);
    return true;
  });

export async function addUser(name: string, pw: string) {
  return lockedUsers(async () => {
    const users = await readUsers();
    if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) throw new Error('Benutzer existiert bereits');
    users.push({ id: crypto.randomUUID(), name, hash: await hashPassword(pw), ver: 1 });
    await writeUsers(users);
  });
}

// ---- Sitzungen -------------------------------------------------------------
let secretCache: Buffer | null = null;
async function secret(): Promise<Buffer> {
  if (secretCache) return secretCache;
  const fromEnv = env('SESSION_SECRET');
  if (fromEnv && fromEnv.length >= 32) return (secretCache = Buffer.from(fromEnv));
  const file = path.join(dataDir(), 'secret.key');
  try { secretCache = Buffer.from((await fs.readFile(file, 'utf8')).trim(), 'hex'); }
  catch {
    secretCache = crypto.randomBytes(32);
    await fs.mkdir(dataDir(), { recursive: true });
    await fs.writeFile(file, secretCache.toString('hex'), { mode: 0o600 });
  }
  return secretCache;
}
const sign = async (data: string) => crypto.createHmac('sha256', await secret()).update(data).digest('base64url');
const safeEqual = (a: string, b: string) => a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function createSession(user: User): Promise<string> {
  const payload = Buffer.from(JSON.stringify({ u: user.id, v: user.ver, exp: Date.now() + SESSION_HOURS * 3600_000 })).toString('base64url');
  return `${payload}.${await sign(payload)}`;
}

export async function readSession(token: string | undefined): Promise<{ user: { id: string; name: string }; csrf: string } | null> {
  if (!token) return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig || !safeEqual(sig, await sign(payload))) return null;
  try {
    const { u, v, exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (typeof exp !== 'number' || exp < Date.now()) return null;
    const user = await findUserById(u);
    if (!user || user.ver !== v) return null;
    return { user: { id: user.id, name: user.name }, csrf: await sign(`csrf:${token}`) };
  } catch { return null; }
}
export const checkCsrf = async (expected: string | undefined, given: FormDataEntryValue | null) =>
  !!expected && typeof given === 'string' && safeEqual(expected, given);

// ---- Login-Sperre: 5 Fehlversuche / 15 Minuten je IP und Benutzername ------
const fails = new Map<string, { n: number; until: number; first: number }>();
const WINDOW = 15 * 60_000;
export function loginBlocked(key: string): number {
  const f = fails.get(key);
  return f && f.n >= 5 && f.until > Date.now() ? Math.ceil((f.until - Date.now()) / 60_000) : 0;
}
export function loginFailed(key: string) {
  const now = Date.now();
  const f = fails.get(key);
  if (!f || now - f.first > WINDOW) fails.set(key, { n: 1, first: now, until: 0 });
  else { f.n += 1; if (f.n >= 5) f.until = now + WINDOW; }
  if (fails.size > 5000) fails.clear();
}
export const loginSucceeded = (key: string) => fails.delete(key);

/** Gegen Zeitmessung: auch bei unbekanntem Benutzer wird ein scrypt-Vergleich ausgeführt. */
export const DUMMY_HASH = 'scrypt$AAAAAAAAAAAAAAAAAAAAAA==$' + Buffer.alloc(64).toString('base64');
