# CLAUDE.md

Working notes for Claude Code on this repo. Read this before touching anything.

---

## What this is

**Trilha** — a personal training log for juggling and partner acro. Single
user, two devices (phone at the gym, laptop at home). Deployed static to GitHub
Pages, synced through Supabase.

It is a hobby app for one person. Optimise for **clarity and correctness of the
domain model**, not for scale, abstraction, or future-proofing. There is no
team, no SLA, and no second customer. Do not add infrastructure for problems we
do not have.

---

## The domain model — read this twice

Everything in this app follows from one idea. Get it wrong and nothing else
makes sense.

> **Positions are nodes. Skills are edges. Sequences are paths.
> A path that returns to its starting position is a loop —
> a *washing machine*, in acro.**

- A **Position** is a state you can be in. In juggling: cascade, shower, box,
  hands empty. In acro: standing, bird, throne, whale, star.
- A **Skill** is a directed edge — it takes you *from* one position *to*
  another. "Barrel roll" is not a thing you have, it's the edge from Bird to
  Reverse Bird.
- A **Sequence** is an ordered list of skills. It is *connected* when each skill
  starts where the previous one ended. It is a *loop* (a washing machine) when
  it is connected **and** the last skill lands back on the first skill's
  starting position.
- A **LogEntry** records one attempt at one skill on one day.

Consequences you must respect:

- A skill with `from === to` is a self-loop (441 returns you to cascade). This
  is legal and common. Do not treat it as invalid data.
- Positions are first-class rows, never free-text strings on a skill. The whole
  point is that "hip key" and "hipkey" must be the same node. Never introduce a
  `string` position field.
- Sequence connectivity is **derived**, never stored. Compute it from the graph.

### The two disciplines are not symmetric

This is the second thing to get right.

|  | Juggling | Acro |
|---|---|---|
| Progress is measured in | counts (best run, drops) | feel and role |
| Has siteswap | yes | no |
| Involves a partner | no | yes — status is really per (skill, role, partner) |
| Node vocabulary | patterns | shapes |

So `LogEntry` has two shapes sharing one table. Juggling entries fill
`props / bestRun / drops`; acro entries fill `role / partner / felt`. Nulls in
the other columns are expected and correct — do not "fix" this by splitting
tables or by filling defaults.

Current simplification, deliberately: `Skill.status` is a single value, not per
partner. This is a known lie for acro (a trick you have with one base is not a
trick you have with everyone). Logs are the source of truth; status is a
convenience. Do not build per-partner status until asked.

---

## Stack, and why

| Layer | Choice | Why |
|---|---|---|
| Package manager, scripts, test runner | **Bun** | Fast, one tool, `bun test` is quick enough to run on save |
| Dev server + production build | **Vite** | Bun's bundler has no React Fast Refresh. Vite's is battle-tested |
| Language | **TypeScript, strict** | The graph has real invariants worth encoding |
| UI | **React 19** | — |
| Client state | **Zustand** | See below |
| Routing | **React Router, `HashRouter`** | See below |
| Styling | **Plain CSS + custom properties** | See below |
| Backend | **Supabase** (Postgres, auth, RLS) | Free tier, real SQL, magic-link auth |
| Hosting | **GitHub Pages** via Actions | Free, static |

### Why Zustand and not TanStack Query

TanStack Query models the server as the truth and the client as a cache. This
app is the other way round: it is **local-first**. The user is in a gym with
bad wifi, they log a run, and it must appear instantly and survive a refresh
whether or not the network cooperated. Supabase is a *replica*, not an
authority.

So: one Zustand store holding the whole deck, persisted to `localStorage`, with
writes fired at Supabase optimistically. If a write fails, surface it — never
swallow it, never silently roll back.

### Why HashRouter

GitHub Pages serves static files. With `BrowserRouter`, refreshing on
`/trilha/build` returns a 404 because no such file exists, and the usual fix
(copying `index.html` to `404.html`) is a hack. `HashRouter` sidesteps it
entirely. The URL is uglier; nobody is sharing these links.

Routing exists at all so the phone back button works. Do not replace it with
`useState` tabs.

### Why plain CSS and not Tailwind

The design system encodes two dimensions in one channel:

- **Hue = discipline.** Amber for juggling, teal for acro.
- **Intensity = status.** Dashed for want, half for working, solid for got.

This works because `--hue` is swapped at runtime on `:root` and every component
reads it. Tailwind's static class generation fights this; you'd end up with
`data-*` variants and arbitrary values reimplementing custom properties badly.

Tokens live in `src/styles/tokens.css`. Component styles are co-located CSS
modules. **Never hardcode a hex value in a component** — if you need a colour
that isn't a token, add a token.

---

## Layout

```
src/
  domain/          Pure TypeScript. No React. No Supabase. No I/O.
    types.ts       Position, Skill, LogEntry, Sequence, Discipline, Status
    graph.ts       sequence resolution, connectivity, loops, bridges
    siteswap.ts    siteswap validation and ball count
    *.test.ts      bun test lives next to the code
  data/
    supabase.ts    client singleton
    db.types.ts    GENERATED — do not hand-edit
    mappers.ts     snake_case row <-> camelCase domain. The only place mapping happens
    repo.ts        CRUD + full pull
    seed.ts        first-run content
  store/
    useDeck.ts     the deck + optimistic sync
    useUi.ts       view, discipline, chain-in-progress
  features/
    skills/ log/ build/ map/ auth/
  components/      shared primitives only (Sheet, Toast, Seg, Card)
  styles/
    tokens.css base.css
```

### The one architectural rule

**`src/domain` may not import from anywhere else in the app.** No React, no
Supabase, no store. It is pure functions over plain data.

This is the rule worth defending, because the graph logic is the only part of
this codebase where a bug is *silent* — a broken sequence validator produces
plausible-looking wrong answers. Pure and tested means you can trust it.

Dependency direction: `domain ← data ← store ← features`. Never backwards.

---

## Commands

```bash
bun install
bun dev            # vite dev server, http://localhost:5173
bun run build      # -> dist/
bun run preview    # serve dist/ locally
bun test           # domain tests
bun test --watch
bun run typecheck  # tsc --noEmit
bun run gen:types  # regenerate src/data/db.types.ts from the live schema
```

---

## Conventions

- **Types from the database are generated**, not written. `supabase/schema.sql`
  is the single source of truth. Change SQL → run `bun run gen:types` → fix
  what breaks. Never hand-edit `db.types.ts`.
- **Mapping lives only in `data/mappers.ts`.** If `from_position` or `acro_role`
  appears anywhere else in `src/`, that's a bug.
- **Domain functions take plain data and return plain data.** No classes, no
  `this`, no mutation of inputs.
- **IDs are UUIDs generated client-side** with `crypto.randomUUID()`. This lets
  optimistic inserts have their final ID immediately, so the UI never has to
  reconcile a temporary key.
- **Tests cover `src/domain` only.** Do not write React component tests for
  this app; they cost more than they catch here.
- Components: one per file, named export, co-located `.module.css`.
- No barrel `index.ts` files. Import from the real path.

---

## Gotchas

**Vite env vars are baked in at build time.** `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` come from `.env.local` in dev and from GitHub Actions
secrets in CI. This is why Pages is deployed by a workflow rather than served
from a branch.

**The anon key is public and that is fine.** It's an identifier, not a secret;
row-level security is what protects the data. `service_role` must never appear
in this repo or in any `VITE_`-prefixed variable — that key bypasses RLS.

**`role` is a reserved word in SQL.** The acro role column is `acro_role`.

**Supabase pauses free projects after 7 days of no database activity.**
`.github/workflows/keepalive.yml` pings it daily. If the app suddenly can't
connect, check whether the project is paused before debugging code.

**GitHub disables scheduled workflows after 60 days without commits.** If you
go quiet for two months, re-enable the keepalive job.

**`base` in `vite.config.ts` must match the repo name** (`/trilha-app/`) or
every asset 404s on Pages. If you rename the repo, change it.

---

## Working agreement

- Prefer deleting code to adding it.
- When a change touches the graph model, write the test first.
- If you're about to add a dependency, say what it replaces and why the
  30 lines it saves are worth the maintenance.
- If a request conflicts with the domain model above, say so instead of
  quietly working around it.
- Don't add: state machines, a service layer, dependency injection, an ORM,
  a component library, or an offline write queue. If one of those becomes
  genuinely necessary, argue for it explicitly first.

---

## Roadmap, roughly

1. Port the four views from the prototype
2. Cycle **discovery** — surface washing machines the user already has the
   pieces for, rather than waiting for them to build one by hand
3. Siteswap validation on skill entry (`(i + s[i]) mod period` must be a
   permutation)
4. Video on log entries via Supabase Storage
5. Per-partner acro status

---

## Agent skills

### Issue tracker

Issues live as GitHub issues on `rodrigoeidelvein/trilha`, driven by the `gh`
CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The five canonical triage roles, each label named after its role. See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` and `docs/adr/` at the repo root. See
`docs/agents/domain.md`.