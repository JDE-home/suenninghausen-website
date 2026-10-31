// End-to-End-Test: startet den gebauten Server (npm run build zuerst!) und prüft den Verwaltungsbereich.
import { test, before, after, describe } from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

// Minimaler Upstash-Redis-Ersatz (REST): versteht GET, SET, DEL.
function fakeRedis(token) {
  const store = new Map();
  const server = http.createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      if (req.headers.authorization !== `Bearer ${token}`) { res.writeHead(401).end(JSON.stringify({ error: 'unauthorized' })); return; }
      const [cmd, key, value] = JSON.parse(body);
      let result = null;
      if (cmd === 'GET') result = store.get(key) ?? null;
      else if (cmd === 'SET') { store.set(key, value); result = 'OK'; }
      else if (cmd === 'DEL') result = store.delete(key) ? 1 : 0;
      else { res.writeHead(400).end(JSON.stringify({ error: `unbekannt: ${cmd}` })); return; }
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ result }));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, store, url: `http://127.0.0.1:${server.address().port}` })));
}

const PW = 'test-passwort-123';
async function startServer(port, extraEnv) {
  const dataDir = mkdtempSync(path.join(tmpdir(), 'sh-test-'));
  const child = spawn('node', ['dist/server/entry.mjs'], { env: { ...process.env, HOST: '127.0.0.1', PORT: String(port), DATA_DIR: dataDir, ADMIN_USER: 'admin', ADMIN_PASSWORD: PW, ...extraEnv }, stdio: 'ignore' });
  for (let i = 0; i < 50; i++) { try { await fetch(`http://127.0.0.1:${port}/`); return { child, dataDir }; } catch { await new Promise((r) => setTimeout(r, 200)); } }
  child.kill();
  throw new Error('Server startet nicht');
}

for (const [mode, PORT] of [['Dateispeicher (Docker/VPS)', 4399], ['Redis (Vercel)', 4398]]) describe(`Speicher: ${mode}`, () => {
const BASE = `http://127.0.0.1:${PORT}`;
const redisMode = mode.startsWith('Redis');
let server, dataDir, redis;
let cookie = '';

const req = (url, opts = {}) => fetch(BASE + url, { redirect: 'manual', ...opts, headers: { ...(cookie ? { cookie } : {}), ...opts.headers } });
const form = (url, data) => req(url, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', origin: BASE }, body: new URLSearchParams(data) });
const csrf = async (url = '/admin/') => (await (await req(url)).text()).match(/name="_csrf" value="([^"]+)"/)?.[1];
const eventData = (over = {}) => ({ title: 'Testfest', start: '2030-05-04', end: '', time: '18:30', location: 'Dorfplatz', club: 'heimatverein', category: 'dorfleben', description: 'Ein Test.', ...over });


before(async () => {
  const extra = {};
  if (redisMode) {
    redis = await fakeRedis('geheim-token');
    extra.KV_REST_API_URL = redis.url;
    extra.KV_REST_API_TOKEN = 'geheim-token';
  }
  ({ child: server, dataDir } = await startServer(PORT, extra));
});
after(() => { server?.kill(); redis?.server.close(); rmSync(dataDir, { recursive: true, force: true }); });

test('Verwaltung ohne Login ist gesperrt', async () => {
  const r = await req('/admin/');
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /\/admin\/login\//);
  assert.equal((await req('/admin/termine/neu/')).status, 302);
});

test('Falsches Passwort wird abgelehnt, richtiges meldet an', async () => {
  const bad = await form('/admin/login/', { name: 'admin', password: 'falsch-falsch' });
  assert.equal(bad.status, 200);
  assert.match(await bad.text(), /stimmt nicht/);
  assert.equal(bad.headers.get('set-cookie'), null);

  const ok = await form('/admin/login/', { name: 'admin', password: PW });
  assert.equal(ok.status, 302);
  const set = ok.headers.get('set-cookie');
  assert.match(set, /HttpOnly/i);
  assert.match(set, /SameSite=Strict/i);
  cookie = set.split(';')[0];
  assert.equal((await req('/admin/')).status, 200);
});

test('Änderungen ohne CSRF-Token werden abgelehnt', async () => {
  const r = await form('/admin/termine/neu/', eventData());
  assert.equal(r.status, 403);
});

test('Termin anlegen → sofort öffentlich sichtbar und im Kalender-Feed', async () => {
  const token = await csrf('/admin/termine/neu/');
  const r = await form('/admin/termine/neu/', { ...eventData(), _csrf: token });
  assert.equal(r.status, 302);
  assert.match(r.headers.get('location'), /m=created/);
  assert.match(await (await req('/termine/')).text(), /Testfest/);
  const ics = await (await req('/termine.ics')).text();
  assert.match(ics, /SUMMARY:Testfest/);
  assert.match(ics, /DTSTART;VALUE=DATE:20300504/);
});

test('Ungültige Eingaben zeigen Fehler und speichern nichts', async () => {
  const token = await csrf('/admin/termine/neu/');
  const r = await form('/admin/termine/neu/', { ...eventData({ title: '', start: '2030-02-31', time: '25:99', club: 'gibts-nicht' }), _csrf: token });
  assert.equal(r.status, 200);
  const html = await r.text();
  for (const msg of ['Titel', 'gültiges Datum', 'Uhrzeit', 'Veranstalter']) assert.match(html, new RegExp(msg));
});

test('HTML in Eingaben wird maskiert (XSS)', async () => {
  const token = await csrf('/admin/termine/neu/');
  await form('/admin/termine/neu/', { ...eventData({ title: '<script>alert(1)</script>', start: '2030-06-01' }), _csrf: token });
  const html = await (await req('/termine/')).text();
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.match(html, /&lt;script&gt;alert\(1\)/);
});

test('Termin bearbeiten und löschen', async () => {
  const list = await (await req('/admin/')).text();
  const id = list.match(/href="\/admin\/termine\/(testfest-[^/"]+)\//)[1];
  const token = await csrf(`/admin/termine/${id}/`);
  const edit = await form(`/admin/termine/${id}/`, { ...eventData({ title: 'Testfest geändert', time: '19:00' }), _csrf: token });
  assert.match(edit.headers.get('location'), /m=saved/);
  assert.match(await (await req('/termine/')).text(), /Testfest geändert/);

  const del = await form('/admin/', { action: 'delete', id, _csrf: await csrf() });
  assert.match(del.headers.get('location'), /m=deleted/);
  assert.ok(!(await (await req('/termine/')).text()).includes('Testfest geändert'));
});

test('Wöchentliche Serie legt mehrere Termine an', async () => {
  const token = await csrf('/admin/termine/neu/');
  const r = await form('/admin/termine/neu/', { ...eventData({ title: 'Stammtisch', start: '2030-03-01' }), repeat: 'weekly', until: '2030-03-22', _csrf: token });
  assert.match(r.headers.get('location'), /n=4/);
  const html = await (await req('/termine/')).text();
  assert.equal((html.match(/Stammtisch/g) ?? []).length >= 4, true);
});

test('Beispieleinträge lassen sich entfernen, Verlauf stellt sie wieder her', async () => {
  assert.match(await (await req('/')).text(), /demo-banner/);
  const purge = await form('/admin/', { action: 'purge-demo', _csrf: await csrf() });
  assert.match(purge.headers.get('location'), /m=purged/);
  assert.ok(!(await (await req('/termine/')).text()).includes('Adventsbasar'));

  const hist = await (await req('/admin/verlauf/')).text();
  const files = [...hist.matchAll(/name="file" value="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(files.length > 3);
  // ältester Stand = Beispieldaten
  const restore = await form('/admin/verlauf/', { file: files.at(-1), _csrf: await csrf('/admin/verlauf/') });
  assert.match(restore.headers.get('location'), /m=restored/);
  assert.match(await (await req('/termine/')).text(), /Adventsbasar/);
  assert.equal((await form('/admin/verlauf/', { file: '../../etc/passwd', _csrf: await csrf('/admin/verlauf/') })).headers.get('location').includes('notfound'), true);
});

test('Verein mit Terminen kann nicht gelöscht werden', async () => {
  const r = await form('/admin/vereine/', { action: 'delete', id: 'heimatverein', _csrf: await csrf('/admin/vereine/') });
  assert.match(r.headers.get('location'), /m=inuse/);
});

test('Sicherheits-Header sind gesetzt', async () => {
  const r = await req('/admin/');
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
});

test('Passwort ändern macht alte Sitzung ungültig, neue funktioniert', async () => {
  const oldCookie = cookie;
  const r = await form('/admin/passwort/', { current: PW, next: 'neues-passwort-456', again: 'neues-passwort-456', _csrf: await csrf('/admin/passwort/') });
  assert.equal(r.status, 302);
  const fresh = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await req('/admin/', { headers: { cookie: oldCookie } })).status, 302);
  cookie = fresh;
  assert.equal((await req('/admin/')).status, 200);
});

test('Nach 5 Fehlversuchen wird die Anmeldung kurz gesperrt', async () => {
  cookie = '';
  for (let i = 0; i < 5; i++) await form('/admin/login/', { name: 'admin', password: 'x'.repeat(12) });
  const r = await form('/admin/login/', { name: 'admin', password: 'neues-passwort-456' });
  assert.match(await r.text(), /Zu viele Fehlversuche/);
});

if (redisMode) {
  test('Daten liegen in Redis – nicht auf der Festplatte', () => {
    for (const key of ['sh:content', 'sh:users', 'sh:secret', 'sh:history:index']) assert.ok(redis.store.has(key), `${key} fehlt in Redis`);
    assert.deepEqual(readdirSync(dataDir), []);
  });
}

});

describe('Vercel ohne verbundenen Speicher', () => {
  const PORT2 = 4397;
  let srv, dir;
  before(async () => { ({ child: srv, dataDir: dir } = await startServer(PORT2, { VERCEL: '1' })); });
  after(() => { srv?.kill(); rmSync(dir, { recursive: true, force: true }); });

  test('öffentliche Seite funktioniert (schreibgeschützt, Beispieldaten)', async () => {
    const r = await fetch(`http://127.0.0.1:${PORT2}/termine/`);
    assert.equal(r.status, 200);
    assert.match(await r.text(), /Adventsbasar/);
  });
  test('Verwaltung zeigt eine Einrichtungs-Anleitung statt eines Fehlers', async () => {
    const r = await fetch(`http://127.0.0.1:${PORT2}/admin/login/`, { redirect: 'manual' });
    assert.equal(r.status, 503);
    assert.match(await r.text(), /Upstash Redis/);
    assert.deepEqual(readdirSync(dir), []); // es wurde nichts auf die (schreibgeschützte) Platte geschrieben
  });
});
