import { createClient } from '@supabase/supabase-js';
import type { Database } from './db.types';

/**
 * The client singleton. Non-null: a missing variable throws in
 * `vite.config.ts`, so "unconfigured" is not a runtime state (ADR-0010).
 *
 * PKCE, not the default implicit flow: the implicit flow returns the session
 * in the URL *fragment*, and under HashRouter the fragment is the route
 * (ADR-0009). PKCE comes back with `?code=…` in the query string instead and
 * never touches the hash.
 */
export const supabase = createClient<Database>(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  { auth: { flowType: 'pkce' } },
);
