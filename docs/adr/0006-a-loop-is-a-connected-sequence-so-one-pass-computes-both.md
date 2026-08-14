# A Loop is a connected Sequence, so one pass computes both

Sequence analysis is a single function, `analyseSequence(skills)`, returning
`{ joints, connected, loop, from, to }`. It is not split into `isConnected`,
`isLoop` and `breaks`, and `loop` is defined as *connected **and** ends where it
begins* rather than as a separate fact about the endpoints.

The prototype splits them by accident and is wrong because of it. `analyse`
returns `closed` computed as `ss.length > 1 && ss[0].from === ss[ss.length-1].to`
(`app.js:293`) with no reference to `allOk`, and the Build view only ever reads
it inside an `if (allOk)` branch — so the bug stays hidden there. `saveseq`
reads it alone (`app.js:503`), which means a chain that is broken in the middle
but happens to start and end in the same Position is offered the default name
**"Washing machine"**. `CONTEXT.md` already says a Loop is *a connected Sequence
that ends where it began*; the prototype's field simply does not implement the
glossary.

Separate predicates would have preserved that hazard in a new form — a caller
free to ask `isLoop` without asking `isConnected` — and would walk the same
sequence up to three times to answer questions that fall out of one traversal.
One function whose result makes the invalid combination unrepresentable is both
smaller and safer. The Build view wants the combined pass regardless: it renders
every joint positionally, so it needs the per-joint verdicts and the summary
together.

**A `Joint` is a discriminated union**, following ADR-0002: a connected joint
carries the one Position where the Skills meet, a broken one carries the two
Positions that failed to meet. The prototype's `{ ok: boolean }` forces the view
to re-derive both from `ss[i-1].to` and `s.from`, which is exactly the
neighbour-poking the module exists to absorb.

## Consequences

**A lone self-loop is a Loop.** The prototype requires `length > 1`; the
glossary does not, and a single `441` genuinely returns you to Cascade and runs
continuously without a reset. Dropping the length test follows `CLAUDE.md`'s
rule that a Skill with `from === to` is ordinary data. Not celebrating a
one-Skill Loop in the UI is a Build-view choice, and the view keeps its
`length > 1` guard on the verdict banner — the domain no longer bakes a
presentation rule into a definition.

**An empty Sequence is vacuously connected**: no joints, so none broken.
`loop` is `false` and `from`/`to` are `null` — the only case where they are.
Both are worth a test, because vacuous truth is where a reader's intuition and
the code most easily disagree.

**The analysis does not return the skills it was given.** The prototype's `ss`
existed only because resolution happened inside the function; with resolution
moved out (ADR-0007) the caller already holds the array it passed in.
