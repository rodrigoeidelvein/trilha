# Deleting a Skill takes its LogEntries with it

The database already decided this and nobody told the client.
`logs_skill_id_fkey` is `ON DELETE CASCADE` (`supabase/schema.sql:207`), so
deleting a Skill destroys every LogEntry that references it, server-side, today.

The prototype deletes the Skill locally and leaves the LogEntries, which then
render as "(deleted skill)" in the Log view (`app.js:271`). That placeholder
looks like a contract — a deliberate choice to keep the history and admit the
Skill is gone — and it is not one. It is a view of rows that no longer exist
anywhere except this device, and the next `pull()` removes them without a word.
The Log view is showing you a training history that the server destroyed
several seconds ago.

So the client mirrors the cascade: **deleting a Skill removes the Skill and its
LogEntries from the deck.** Local and remote agree at the moment of the write
rather than at the next boot, and "(deleted skill)" stops existing.

Because the delete destroys history, the confirmation has to state the cost:
"Delete *Barrel roll*? 12 logged attempts go with it." That sentence is the
whole of the protection, and it is deliberate that there is no more than that.

The alternative worth recording as rejected is **`ON DELETE RESTRICT` on
`logs.skill_id`**, making a Skill with history undeletable. It protects the
record properly, `CONTEXT.md` argues for it (**LogEntry**: "never derived from
anything else"), and it could ride on the migration #10 already opens. It is
rejected because the case it fires on is the case you most need to resolve — a
duplicate Skill with attempts logged against both spellings — and there is no
merge tool to escape with, so it would convert a tidy-up into a dead end. It is
worth revisiting if a merge is ever built. Also rejected: `ON DELETE SET NULL`,
which leaves a LogEntry pointing at no Skill — the dangling reference ADR-0003
closed.

## Consequences

**Saved Sequences are untouched, and ADR-0007 stands.** A Sequence may still
hold the id of a deleted Skill, and `resolveSequence` is still where that is
caught. The two references are governed differently on purpose:
`sequences.skill_ids` is a `uuid[]` that cannot carry a foreign key, so the
database will never cascade it, while `logs.skill_id` has one and always will.

**The client deletes one row, not two.** The server's cascade removes the log
rows; the client only drops them from the local deck. Which is why a *failed*
Skill delete resurrects the LogEntries along with the Skill, consistently, per
ADR-0015.

**Positions keep their dormant cascade.** `skills.from_position` and
`skills.to_position` are also `ON DELETE CASCADE` (`supabase/schema.sql:227`,
`:232`), so deleting a Position would take its Skills and their LogEntries. The
prototype has no delete-position UI and the port does not add one — strict
parity. If it is ever added it is a two-level cascade and the confirmation has
to count both levels.

## Amended by #10

The last consequence no longer holds. Both `skills → positions` foreign keys are
`ON DELETE RESTRICT` (`supabase/schema.sql:231`, `:236`), which is what ADR-0003
decided and #10 applied — the paragraph above described the schema as it stood,
not as ADR-0003 had already settled it. There is no dormant cascade to inherit:
deleting a Position with a Skill on it is *refused*, so if a delete-position UI
is ever added it counts edges and says no, rather than counting two levels of
destruction. Everything else here stands, including the deliberate cascade from
`logs` to `skills` (`supabase/schema.sql:211`).
