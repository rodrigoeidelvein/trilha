# A failed delete is not protected, and the row comes back

ADR-0014 protects a failed write by marking the row Unsent. A delete cannot use
that mechanism, because the mechanism is a row: the delete has already removed
it, and there is nothing left to mark.

Honouring a failed delete means remembering that an id *used to* exist — a
tombstone. Tombstones are not a flag, they are an operation log. They have to be
replayed, they have to be reconciled against a `pull()` that legitimately
returns the row, and they have to be garbage-collected once the server agrees,
or a resurrected row can never be re-created. That is precisely the offline
write queue `CLAUDE.md` rules out, and ADR-0014's argument for why the Unsent
set is not one stops working the moment tombstones are added.

So the contract is asymmetric on purpose: **upserts are protected, deletes are
not.** A delete that fails leaves the row on the server, and the next `pull()`
brings it back.

The asymmetry is the justification rather than an oversight. A lost insert is
unrecoverable — a LogEntry records something that happened once and cannot be
reconstructed from anything else (`CONTEXT.md`, **LogEntry**). A resurrected
Skill is visible, sitting in the place you expected it not to be, and is fixed
by deleting it again. Two failures with different costs do not deserve the same
machinery.

## Consequences

**The failure is told plainly at the time it happens** — "Couldn't delete
*Barrel roll*. It may come back next time you open the app" — rather than being
folded into the Unsent count, which would promise a reconciliation that is not
going to happen.

**"0 unsent" does not mean the two copies agree.** It means nothing the deck
holds is missing from the server. A pending resurrection is invisible to the
badge. This is the honest limit of the indicator and it is worth not
overselling in the UI copy.

**A failed Skill delete resurrects its LogEntries too, and that needs no extra
handling.** Deleting a Skill drops its LogEntries locally and relies on the
database's cascade to drop them remotely (ADR-0018). If the delete never
reached the server, the server ran no cascade, so it still holds both — and the
next `pull()` restores both. The outcome is consistent by accident of doing the
simplest thing, which is the reason to write it down rather than discover it.
