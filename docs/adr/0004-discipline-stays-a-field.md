# Discipline stays a field, not a partition

Every Position, Skill, Sequence and LogEntry carries a `discipline`, and no
edge ever crosses between the two disciplines — which means the graph is really
two disjoint graphs, and the sharper model is a partition keyed by discipline
rather than a field repeated on four types.

That model was considered and deferred. The column exists on all four tables
and has to round-trip regardless, and turning it into a partition is a decision
about the shape of the store — it would force the mappers to group rows on pull
and to remember which partition a write came from. Recording it here so it is
not re-proposed as a novelty: it is a known-better model, parked on purpose.

## Consequences

The invariant a partition would have made structural — a Skill's discipline
equals both its endpoints' disciplines — is not enforced by any type or
constraint. It has to be enforced at the single place Skills are created.
Reading, meanwhile, goes through one per-discipline selector rather than an
open-coded `.filter()` at each call site, so the eventual move to a partition
has one seam to change rather than nine.
