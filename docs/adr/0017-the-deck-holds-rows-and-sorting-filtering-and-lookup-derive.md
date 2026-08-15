# The deck holds rows; sorting, filtering and lookup derive

`useDeck` holds four arrays of rows, the Unsent set, and the actions that change
them. It holds no maps, no indexes, and no sorted copies. Everything else —
`pos` / `skill` lookup by id, the discipline filters, the log ordering — is
computed at the call site.

`CLAUDE.md` already rules that Sequence connectivity is derived and never
stored. Sort order, discipline membership and id lookup are the same kind of
fact, and there is no reason for them to be governed differently.

This is not a performance question and should not be argued as one. The seed is
17 Positions and 32 Skills; a linear `find` over that is free, and will still be
free when it has doubled. It is a question of who owns the answer. A
`skillsById` map in the store would remove `find` from about four call sites and
add an invalidation obligation to every mutation and to `pull()` — a
denormalisation with a maintenance duty and no payoff.

The prototype half-owns sort in two places: `pull()` sorts logs by `date + id`
descending (`app.js:117`) while insert `unshift`s (`:494`). They agree only
because the log form always writes `today()`, so the bug is latent rather than
live — a backdated entry would sit at the top until the next reload. The port
should not inherit the arrangement that makes it possible.

One mechanical constraint shapes the interface: a selector returning
`skills.filter(…)` builds a new array on every call, which Zustand v5 reports as
an unstable snapshot. So selectors return the raw arrays, and the filtering,
sorting and lookups happen above them under `useMemo`.

## Consequences

**The derived helpers are plain functions**, taking rows and a Discipline and
returning rows — callable from a memo, testable without React. They do not live
in `src/domain`, because they know about Discipline and ADR-0005 keeps
Discipline out of the graph module on purpose.

**`pull()` stops sorting**, and the deck is stored in whatever order the server
returned. The Log view sorts, because the Log view is what wants an order.

**Tests still stop at `src/domain`.** These helpers are one-line filters over
plain arrays; `CLAUDE.md`'s rule that React component tests cost more than they
catch applies to them too. The open question the map records — whether
`siteswap.ts` and `mappers.ts` earn tests — is untouched by this.
