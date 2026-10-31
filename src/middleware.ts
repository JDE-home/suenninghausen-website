import { defineMiddleware } from 'astro:middleware';
import { SESSION_COOKIE, checkCsrf, ensureAdmin, readSession } from './lib/auth';

const CSP = [
  "default-src 'self'", "img-src 'self' data:", "style-src 'self' 'unsafe-inline'", "script-src 'self'",
  "frame-ancestors 'none'", "base-uri 'self'", "form-action 'self'",
].join('; ');

export const onRequest = defineMiddleware(async (ctx, next) => {
  const path = ctx.url.pathname;
  const isAdmin = path === '/admin' || path.startsWith('/admin/');

  if (isAdmin) {
    await ensureAdmin();
    const session = await readSession(ctx.cookies.get(SESSION_COOKIE)?.value);
    if (session) { ctx.locals.user = session.user; ctx.locals.csrf = session.csrf; }
    if (!session && !path.startsWith('/admin/login')) return ctx.redirect('/admin/login/');

    // Jede Änderung (POST) braucht das Formular-Token der laufenden Sitzung.
    if (session && ctx.request.method === 'POST') {
      const form = await ctx.request.clone().formData().catch(() => null);
      if (!form || !(await checkCsrf(session.csrf, form.get('_csrf')))) {
        return new Response('Die Anfrage konnte nicht bestätigt werden. Bitte die Seite neu laden und noch einmal versuchen.', {
          status: 403, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
        });
      }
    }
  }

  const res = await next();
  const h = res.headers;
  h.set('Content-Security-Policy', CSP);
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (ctx.url.protocol === 'https:' || ctx.request.headers.get('x-forwarded-proto') === 'https') {
    h.set('Strict-Transport-Security', 'max-age=31536000');
  }
  if (isAdmin) {
    h.set('Cache-Control', 'no-store');
    h.set('X-Robots-Tag', 'noindex, nofollow');
  }
  return res;
});
