/** Liest Umgebungsvariablen zur Laufzeit (Node) bzw. aus .env (Entwicklung). */
export const env = (name: string): string | undefined =>
  process.env[name] ?? (import.meta.env as Record<string, string | undefined>)[name];
