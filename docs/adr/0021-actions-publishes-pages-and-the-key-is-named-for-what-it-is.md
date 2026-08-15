# Actions publishes Pages, and the key is named for what it is

GitHub Pages is published by a workflow that builds the app and uploads `dist/`,
never by Pages serving a branch. The build reads two repository secrets:

| Secret | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://lcydzyxyprrglsksgtgd.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | the `sb_publishable_…` key |

Pages must be Actions-built because the credentials are baked into the bundle at
build time (ADR-0010). A branch build runs no build step — it serves the files
in the branch — so it can only ever publish what is already committed in it. The
prototype worked that way because `config.js` was
committed with the values in it. The ported app cannot: `vite.config.ts` throws
when either variable is missing, so the values have to reach a build, and the
only place a build happens is Actions.

## The name

The key is a `sb_publishable_…` key, not the legacy anon JWT. ADR-0010 named the
variable `VITE_SUPABASE_ANON_KEY`, after a key type this project does not use
and the Supabase dashboard no longer displays. `createClient(url, key)` takes
the key positionally and does not care what the variable was called, so the only
thing the name affects is whether the next person looking for its value in the
dashboard finds a field with that label. They would not. Renamed, on the same
grounds as positions being rows: one thing, one name, and the name is the one
printed on the thing.

Verified against the live project with that key: `GET /auth/v1/settings` → 200
with `email: true`, `GET /rest/v1/positions` → 200, `GET /rest/v1/heartbeat` →
200 with the row. It is accepted everywhere the app will use it.

## They are secrets in the storage sense only

Neither value is confidential — the key is public by design and RLS is what
protects the data (#3) — and both are committed in `config.js` today. They live
in Actions *secrets* rather than Actions *variables* because secrets are how a
build gets an injected environment, and rotating the key should not require a
commit. The log masking is a harmless side effect, not the point.

The rule that matters is unchanged and applies to the secret store as much as to
the repo: `service_role` goes in neither. A publishable key in the secret store
is fine; a key that bypasses RLS is not, wherever it is kept.

## Rejected

**Committing the values in the repo and building from them.** It is what the
prototype does, it works, and it costs nothing in secrecy. It also puts the
project URL in two files, and it means a rotated key is a code change. The
secrets exist anyway for the URL; there is no saving.

**Actions variables instead of secrets.** More honest about what the values are,
and it makes them readable in the settings UI. Rejected for the rotation
argument and because a store labelled "not secret" is an invitation to put the
next credential in the wrong one.

## Consequences

**A missing secret fails the deploy**, which is ADR-0010's whole point arriving
where it was aimed. The workflow goes red; Pages keeps serving the last good
build.

**The cutover is ordered, and the order matters.** Pages is on the branch build
today, serving the prototype at `rodrigoeidelvein.github.io/trilha` — the
reference baseline, live. Flipping the source to Actions before a workflow
exists that produces a `dist/` takes the site down and replaces it with nothing.
The flip is the last step of the port, not the first, and it is a human step:
the deploy workflow lands with the app it deploys, and the Pages source changes
once that workflow is green.

**`.env.local` is what a developer sets locally**, with the same two names. It
was not in `.gitignore` — `.env` and `.env.test` were, `.env.local` was not —
which this ADR's commit fixes. Harmless for these two values; not harmless as a
standing rule.
