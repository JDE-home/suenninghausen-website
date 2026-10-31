import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import vercel from '@astrojs/vercel';

// Auf Vercel (Umgebungsvariable VERCEL=1 beim Build) wird der Vercel-Adapter benutzt, sonst der Node-Server (Docker/VPS).
const onVercel = !!process.env.VERCEL;

// Läuft als Node-Server, damit Termine im Admin-Bereich ohne Neubau live gehen.
// SITE_URL = öffentliche Adresse (für den iCal-Feed), z. B. https://suenninghausen.de
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://suenninghausen.example',
  output: 'server',
  adapter: onVercel ? vercel() : node({ mode: 'standalone' }),
  trailingSlash: 'always',
  server: { host: true },
  // Hinter einem Reverse-Proxy (HTTPS) kennt Astro sonst nur „localhost“ und würde jedes Formular
  // als „Cross-site“ ablehnen. Schutz vor CSRF bleibt: Sec-Fetch-Site/Origin-Prüfung, SameSite=Strict
  // und ein Token pro Sitzung. Absolute URLs entstehen nur aus SITE_URL, nie aus dem Host-Header.
  security: { allowedDomains: [{}] },
  // Skripte immer als eigene Datei ausliefern, damit die Content-Security-Policy ohne 'unsafe-inline' auskommt.
  vite: { build: { assetsInlineLimit: 0 } },
});
