/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Both are checked in `vite.config.ts`, so neither is ever undefined here. */
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
