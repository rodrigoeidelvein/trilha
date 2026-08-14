# `LogEntry` is a discriminated union over a flat table

`logs` is one table with two shapes in it: juggling rows fill
`props / best_run / drops` and leave the acro columns null, acro rows fill
`acro_role / partner / felt` and leave the juggling columns null. That shared
table is settled and stays. The domain type does *not* mirror it: `LogEntry` is
`JugglingLogEntry | AcroLogEntry` over a shared base, discriminated on
`discipline`.

The alternative — one flat type with six nullables — makes the domain type a
faithful picture of the row and keeps the mappers trivial. It was rejected
because it leaves every consumer free to read `entry.felt` on a juggling entry
and get `null` rather than a compile error, and free to construct an entry that
is half one shape and half the other. Making those two states unrepresentable
is the main thing strict TypeScript buys in this codebase.

## Consequences

`fromRow.logs` is the one mapper that is not a field copy: it switches on
`row.discipline`, builds one shape or the other, and **discards** the
off-discipline columns rather than failing. The database permits an acro row
with `best_run` set; resolving that permissiveness at the boundary is the
mapper's job, and it is why the mapping direction is asymmetric.
