# A failed write leaves the row unsent, and the local copy wins

The prototype upserts on every mutation, and on failure shows a toast and turns
the sync badge red (`app.js:98`). Nothing else happens. `pull()` then replaces
the entire deck from the server at boot (`app.js:109`), unconditionally.

So the contract that actually ships today is not "the copies diverge". It is
**the failed write survives until you close the app, and then it is destroyed
without a word** — and it is hidden before that, because the badge resets to
"Synced" on the next successful write to any row. The LogEntry you wrote at the
gym was only ever in one place. There is no backup to recover it from.

The deck is the authority and the server is the replica (`CONTEXT.md`, **Deck**).
A boot in which the replica overwrites the authority is the opposite of the
local-first claim the app is built on.

So: a write that fails marks its row **Unsent**, by id, keyed by table, persisted
alongside the deck. `pull()` still runs and still refills the deck from the
server, with two exceptions — an Unsent row keeps its local version, and an
Unsent row the server has never seen is added rather than dropped. The app then
**replays** the Unsent rows once.

## This is not the write queue the working agreement bans

`CLAUDE.md` rules out an offline write queue, and this is not one. A queue
stores *operations*: it is ordered, it is replayed in sequence, and it needs
coalescing rules and conflict handling to be correct. Unsent stores only **which
rows differ**. The payload is read from the deck at replay time, so it is
whatever the row says now — two failed edits to one Skill are one entry, and the
later one wins by construction rather than by a merge rule. Ids are UUIDs
generated client-side, so every write is an upsert against a key that already
exists, which is what makes replay idempotent without any ordering at all.

There is no timer and no scheduler. Replay happens twice: once at boot, after
the pull, and again whenever the user taps the badge. Nothing watches the
network.

The rejected alternative worth recording is **keeping permanent divergence and
warning honestly** — persist the failure and, at the next boot, say "1 change
never reached the server and will be discarded" before pulling. It is a smaller
change and it is not dishonest. It is rejected because the one thing this app
exists to do is record what happened at a training session, and that design
drops exactly that, on exactly the bad gym wifi the local-first architecture was
chosen for. Also rejected: refusing to pull at all while rows are Unsent, which
protects the local copy by making the second device never arrive.

## Consequences

**The badge derives from the Unsent set, not from the last write.** It reads
"2 unsent" and returns to "Synced" only when the set is empty. This is what
makes a failure sticky: a later success on a different row cannot clear it,
which is the specific way the prototype's badge lied.

**The badge is a button**, because replay is the only manual recovery and there
is nowhere else to put it.

**Unsent lives in `useDeck` and is persisted**, because it is a fact about the
deck's relationship to its replica rather than about the UI. The last error
message lives beside it and is not persisted — it describes one attempt, not a
state of the data.

**Replay runs even when the pull failed.** They fail together on a dead network
and there is nothing to gain from sequencing them; a row that fails again simply
stays Unsent.

**Seeding goes through the same write path** (`app.js:195` inserts directly). A
failed seed marks the seeded rows Unsent instead of leaving a seeded phone and
an empty server that nothing will ever reconcile.

**Signing out clears the deck, and clears Unsent with it** (`app.js:528`). A row
that never reached the server does not survive into the next session.

**Deletes are outside this contract entirely.** See ADR-0015.
