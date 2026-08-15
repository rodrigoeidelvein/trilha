# The keepalive is an anonymous read

`.github/workflows/keepalive.yml` runs daily and does one thing: `GET
/rest/v1/heartbeat?select=pinged_at` with the publishable key. It writes
nothing, holds no privileged credential, and fails the run if the response is
not a 200 carrying the row.

Supabase pauses a free project after seven days without activity, and a paused
project is indistinguishable from a bug — the app loads from `localStorage`,
renders the whole deck, and every write fails. That failure looks exactly like
the sync-failure contract in ADR-0014 doing its job. Daily gives seven chances
to miss before it matters.

It reads rather than writes because the `heartbeat` table's RLS grants `anon`
`SELECT` and nothing else. Verified: an anon `PATCH` of `heartbeat` returns
`200` with `[]` — zero rows, silently, because no policy admits the write. A
keepalive that writes therefore needs `service_role`, and a scheduled job that
holds a key which bypasses RLS is a far worse thing to own than a stale
timestamp.

`heartbeat` rather than one of the four domain tables, even though any of them
would touch Postgres just as well: `anon` has no policy on the domain tables, so
`GET /rest/v1/positions` returns `200 []` whether the key is valid, the table is
empty, or RLS refused. `heartbeat` returns a row, so the workflow can assert on
the body and tell a working ping from a silently broken one.

## Consequences

**`pinged_at` never updates.** It records when the row was made, not when it was
last read, and the anon policy is why. The record of whether the keepalive is
running is the workflow's own run history, which is a better one — it is
timestamped, it is per-attempt, and it goes red on its own.

**The two secrets from ADR-0021 gate it.** The keepalive needs no build, but it
reads the URL and key from the same two secrets rather than hardcoding a second
copy of the project URL into a YAML file. Unset secrets fail the run with a
named error rather than a confusing curl failure.

**GitHub disables scheduled workflows after 60 days without commits**, so a long
enough quiet spell disables the guard against exactly the kind of quiet spell it
guards against. Nothing in the repo can fix that; it is in `CLAUDE.md` as a
thing to check when returning.

## Rejected

**A `SECURITY DEFINER` RPC that bumps `pinged_at`, granted to `anon`.** Restores
the column's meaning without handing out a write. It also adds a function, a
grant and a migration to give the workflow's run log a second, worse copy of
itself.

**Granting `anon` `UPDATE` on `heartbeat`.** One row, no user data, so the blast
radius is genuinely small — and it is still a public write endpoint added for
cosmetic value.
