# A Position name is unique after aggressive normalisation

`CLAUDE.md` has always said what Positions-as-rows are *for*: "the whole point
is that 'hip key' and 'hipkey' must be the same node." Nothing enforced it. The
schema let one user hold `Hip Key`, `hipkey` and `hip-key` in acro at once,
three nodes for one shape, with the Skills into each of them unable to compose
and the Map drawing three unconnected dots.

So `positions` gains a unique index over the **normalised** name, scoped to
`(user_id, discipline)`:

```sql
create unique index positions_user_disc_name
  on public.positions
  using btree (user_id, discipline, regexp_replace(lower(name), '[^a-z0-9]', '', 'g'));
```

Lowercase, then delete everything that is not `a-z0-9`. `Hip Key`, `hipkey`,
`hip-key` and `HIP  KEY` all normalise to `hipkey` and only the first one in
wins.

It is a unique **index** rather than a unique constraint because Postgres does
not accept an expression in a `UNIQUE` constraint — the index is the only form
this can take, and it enforces exactly as hard.

## Why the aggressive normalisation and not `lower(name)`

`lower(name)` is the obvious candidate and it fails the documented example.
`hip key` and `hipkey` are already both lowercase; the collision the rule exists
to prevent is the one `lower()` does not catch. Every real duplicate in this
domain is a spacing or punctuation disagreement about a name nobody writes
down consistently — `hip key` / `hipkey`, `star` / `Star`, `reverse bird` /
`reverse-bird` — so the normalisation has to reach the separators or it is
decoration.

The scope is `(user_id, discipline)`, not global. `user_id` because the table is
multi-tenant and RLS already partitions it. `discipline` because the graph never
has an edge crossing between juggling and acro (ADR-0004): a juggling `Star` and
an acro `Star` are two nodes in two disjoint graphs and it is right that they can
coexist.

## Rejected

**A `citext` column, or a `UNIQUE (user_id, discipline, lower(name))`.** Both
solve case drift only, which is the half of the problem that would not have
bitten.

**A stored generated column holding the normalised name.** It makes the rule
visible in `select *`, and then it is a column the mapper has to know about and
the domain has to decide whether to carry. The index does the same work and
`db.types.ts` never grows a field the domain does not want.

**Enforcement in the app only, warning on collision.** The app has to warn
regardless — see below — but the app is not the only writer. The Supabase
dashboard is, and so is a second device replaying an Unsent row it created
while the first device was inserting the same name.

**Making `aka` unique too, or unique against `name`.** An alias is a place to
put the spellings you *know* are the same thing, so the two columns want
opposite rules. Two Positions whose `aka` fields collide is a real duplicate the
database will not catch; the alias is a search convenience and the name is the
identity.

## Verified, not assumed

Replayed `supabase/schema.sql` plus the migration into a Postgres 17 container
and dumped the result: it matches a replay of the edited `schema.sql` byte for
byte, so the committed source of truth is exactly what the migration produces.
Then, against the migrated database:

| | |
|---|---|
| `hipkey`, `hip-key`, `HIP KEY` after `Hip Key`, same user and discipline | all three rejected, `23505` |
| `hipkey` in juggling, with `Hip Key` in acro | inserted |
| `hip key` for a second `user_id` | inserted |
| Skill with a null endpoint | rejected, not-null violation |
| Self-loop (`441`, Cascade → Cascade) | inserted |
| LogEntry with a null `skill_id` | rejected, not-null violation |
| Deleting a Position with a Skill on it | rejected, `skills_from_position_fkey` |
| Deleting that Skill | its LogEntries went with it |
| Deleting the now-unreferenced Position | succeeded |

## Consequences

**The app owes the user a warning before the insert.** A `23505` arriving from
the network is the worst possible way to learn that you already have this
Position — under ADR-0019 it is a permanent failure wearing a sync error's
clothes, and under ADR-0014 the row sits Unsent forever because replaying it
will never succeed. So `src/domain` gets the matching function and the name
field checks the deck as you type. The JavaScript mirror is exact:
`name.toLowerCase().replace(/[^a-z0-9]/g, '')`. Where it lives is #5's call.

**Renaming a Position can now fail.** Renaming `bird` to `Reverse Bird` when a
Reverse Bird exists is the same collision by another route, and the same warning
covers it.

**A name with no `a-z0-9` in it normalises to the empty string.** Two Positions
named only in punctuation, or only in characters outside the ASCII range,
collide with each other. Both disciplines name their shapes in ASCII words and
the app is single-user, so this is accepted rather than worked around — the
alternative is a normalisation the domain function cannot mirror in one line.

**Seeding must not seed a duplicate**, and this is not hypothetical. The
prototype's `seedRemote()` (`app.js:195`) ran twice about 2ms apart on
2026-08-14 and inserted the whole starter deck twice — 34 Positions, 64 Skills,
two disjoint copies of the same graph, both of which then got used, so six
juggling Skills ended up carrying a different Status on each side. It is a
check-then-act: `pull()`, and seed if the deck came back empty, with nothing in
the database able to refuse the second write. This index is that refusal — a
second seed now fails on the first Position instead of doubling the deck — and
it is why the migration adding it had to be preceded by one merging the two
decks. `data/seed.ts` still owes its own guard; the index is the backstop, not
the design.

**Nothing records when a row was last written.** The merge could not ask which
of two Statuses was newer, because there is no `updated_at` on any table, only
`created_at`. It resolved on "the more advanced Status wins" instead. Worth
knowing before anyone reaches for last-write-wins on any future conflict: the
column it would need does not exist.
