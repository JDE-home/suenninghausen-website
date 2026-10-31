import type { APIRoute } from 'astro';
import { toIcs, upcoming } from '../lib/data';
import { getContent } from '../lib/store';

export const GET: APIRoute = async ({ site }) => {
  const { events, clubs } = await getContent();
  return new Response(toIcs(upcoming(events), clubs, (site ?? new URL('https://suenninghausen.example')).toString()), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
  });
};
