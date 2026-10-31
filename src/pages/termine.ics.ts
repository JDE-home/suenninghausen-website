import type { APIRoute } from 'astro';
import { toIcs, upcomingEvents } from '../lib/data';

export const GET: APIRoute = ({ site }) =>
  new Response(toIcs(upcomingEvents(), (site ?? new URL('https://suenninghausen.example')).toString()), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8' },
  });
