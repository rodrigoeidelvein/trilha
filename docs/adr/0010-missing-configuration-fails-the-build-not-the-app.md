# Missing configuration fails the build, not the app

`vite.config.ts` reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` with
`loadEnv` and throws if either is missing or empty, naming the two variables and
`.env.local`. Nothing downstream checks again: `data/supabase.ts` exports a
non-null client, and "unconfigured" stops existing as a runtime state.

The prototype had to check at runtime. `config.js` shipped with a
`YOUR-PROJECT-REF` placeholder, so an unconfigured app was a real thing a real
person could open, and `configured` (`app.js:16`), the null `sb`, and the
`#cfgWarn` box in the Gate all exist to greet them. Under Vite the variables are
baked into the bundle at build time, which moves the failure earlier and changes
who hits it: not a user with an unconfigured page, but a developer with no
`.env.local`, or a CI run with an unset secret. Both of those are better served
by a build that stops than by a bundle that ships and explains itself in the
browser. The variables are also not secrets — the key is public and RLS is what
protects the data (verified in #3) — so there is nothing here that has to stay a
runtime lookup.

## Consequences

**Three pieces of prototype machinery are deleted, not ported.** The
`configured` flag, the `Client | null` type, and the Gate's `#cfgWarn` box. With
ADR-0009 removing the nullable user, every write path loses its
`if (!sb || !user) return` guard and starts at the call.

**A missing CI secret fails the deploy instead of publishing a dead page.** The
failure mode this replaces is the bad one: Actions builds green, Pages serves,
and the app throws on `createClient` in front of the user. #9 owns naming those
secrets; this ADR is why the workflow will go red if they are absent.

**The check must use `loadEnv`, not `process.env`.** Vite does not load
`.env.local` into the config's own environment, so reading `process.env` there
would fail for every developer and pass in CI — the exact inversion of what this
is for.

**A present-but-wrong URL is still a runtime failure**, and correctly so. It is
indistinguishable from the project being paused or the wifi being bad, which is
#8's sync-failure contract, not a configuration state.

## Amended by ADR-0021

The second variable is `VITE_SUPABASE_PUBLISHABLE_KEY`, not
`VITE_SUPABASE_ANON_KEY`. The project's key is a `sb_publishable_…` key and the
dashboard no longer shows an "anon key" to go looking for. Only the name
changes; everything decided above holds, and `vite.config.ts` throws on the new
name.
