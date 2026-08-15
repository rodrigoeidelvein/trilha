# `persist` owns durability, and hydration gates the pull

Zustand's `persist` middleware replaces `cache()` and `readCache()`
(`app.js:91`–`92`), which are deleted.

In the prototype, durability is something each mutation has to remember to do:
`push()` and `remove()` each open with a `cache()` call, and `seedRemote()`
carries its own copy (`app.js:198`) because it does not go through either. Three
call sites, one of them already a duplicate, for an invariant that has no
exceptions. `persist` subscribes to the store, so it cannot be forgotten by a
mutation added later.

The rehydration signal is the part that decides it over keeping the manual
write. Boot becomes an explicit order — **rehydrate → render from the local deck
→ pull → replay** — and `pull()` must not run before hydration finishes, or it
writes a deck that hydration then overwrites. The prototype's `readCache()` is
synchronous, so it gets this right by accident of statement order (`app.js:546`)
rather than by saying anything. Making the gate explicit is worth more here than
in most apps, because the whole architecture rests on the local copy being the
authority at the moment the first frame renders.

`partialize` keeps the four row arrays and the Unsent set (ADR-0014) durable,
and leaves the last sync error out — it describes one attempt, not a state of
the data.

The rejected alternative is keeping `cache()` manual "so that durability is
explicit at the point of the write". It is not explicit today; it is implicit in
three places and already wrong in one of them.

## Consequences

**Every mutation must produce a new object.** The prototype mutates in place and
pushes the same reference (`app.js:441`, `:471`), which React would not re-render
from anyway — so this changes with or without `persist`, and is not a cost of
this decision.

**The store gets a `version`**, set to 1, as the hook for a shape migration. No
`migrate` function is written until something needs one; ADR-0003's total-edge
migration (#10) is the first change that plausibly could.

**Writing the whole deck on every mutation is unchanged from the prototype** and
stays fine at this scale — the seed alone is 17 Positions and 32 Skills, and
LogEntries accumulate at the speed of a person going to training.

**"Loading your deck…" is the pre-hydration state** (`CONTEXT.md`, **Deck**) —
the one moment where no local copy exists yet. It sits above the auth gate,
which ADR-0009 already put above the router.
