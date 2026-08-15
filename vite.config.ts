import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Missing configuration fails the build, not the app (ADR-0010).
 *
 * `loadEnv`, not `process.env`: Vite does not load `.env.local` into the
 * config's own environment, so reading `process.env` here would fail for
 * every developer and pass in CI — the exact inversion of what this is for.
 */
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'] as const;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const missing = REQUIRED.filter((name) => !env[name]);
  if (missing.length > 0) {
    throw new Error(
      `${missing.join(' and ')} ${missing.length === 1 ? 'is' : 'are'} not set. ` +
        'In development they come from .env.local; in CI, from the repository ' +
        'secrets of the same names. See ADR-0021.',
    );
  }

  // Assets resolve relative to the page, not the repo name (ADR-0020).
  return { base: './', plugins: [react()] };
});
