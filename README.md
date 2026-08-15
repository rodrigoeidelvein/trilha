# Trilha

A personal training log for juggling and partner acro.

> Positions are nodes. Skills are edges. Sequences are paths.
> A path that returns to its starting position is a loop —
> a *washing machine*, in acro.

Vite + React 19 + strict TypeScript, a Zustand deck persisted to
`localStorage`, and Supabase as the replica. Deployed to
[rodrigoeidelvein.github.io/trilha](https://rodrigoeidelvein.github.io/trilha)
by GitHub Actions.

## Running it

```bash
bun install
bun dev            # http://localhost:5173
bun test           # domain tests
bun run typecheck
bun run build      # -> dist/
```

`bun dev` and `bun run build` both need `.env.local`:

```
VITE_SUPABASE_URL=…
VITE_SUPABASE_PUBLISHABLE_KEY=…
```

Neither value is confidential — the key is an identifier and row-level security
is what protects the data — but a missing one throws in `vite.config.ts` rather
than shipping an app that fails in the browser. In CI they come from repository
secrets of the same names.

## Reading it

- `CLAUDE.md` — the working notes: the domain model, the stack, the rules.
- `CONTEXT.md` — the vocabulary. What a Loop is, what Unsent means.
- `docs/adr/` — why each decision went the way it did.

The prototype this was ported from — a single `index.html` / `app.js` /
`styles.css` — is at commit `b12af46`.
