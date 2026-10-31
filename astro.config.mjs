import { defineConfig } from 'astro/config';

// Domain später anpassen (wird für iCal-Feed & Canonical-URLs genutzt)
export default defineConfig({
  site: 'https://suenninghausen.example',
  trailingSlash: 'always',
});
