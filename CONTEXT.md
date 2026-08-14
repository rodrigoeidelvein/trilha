# Trilha

A personal training log for juggling and partner acro. The model is a directed
graph: what you can *be* in is a node, what you can *do* is an edge between two
nodes, and what you practise is a path through them.

## Language

### The graph

**Position**:
A state you can hold and be recognised in — a juggling pattern like Cascade, or
an acro shape like Throne. Positions are rows, never free text, so that two
spellings of one shape are one node.
_Avoid_: shape, pattern, state, node (when speaking about the domain rather than the graph)

**Skill**:
A directed edge from one Position to another — the thing you practise to get
from here to there. A Skill whose two Positions are the same is a **self-loop**
and is ordinary, not malformed.
_Avoid_: trick, move, transition

**Sequence**:
An ordered list of Skills. It is **connected** when each Skill starts at the
Position the previous one ended in.
_Avoid_: routine, combo, chain, path

**Joint**:
The meeting point between two consecutive Skills in a Sequence. A joint holds
when the first Skill's ending Position is the second's starting Position, and
**breaks** when it is not — the break is named by the two Positions that failed
to meet, not by the Skills either side of it.
_Avoid_: link, transition, seam

**Loop**:
A connected Sequence that ends where it began, so it can be run continuously
without a reset. In acro this is called a **washing machine**; in juggling, a
closed loop. A single self-loop Skill is a Loop — the Sequence need not have
more than one Skill in it.
_Avoid_: cycle, circuit

**Bridge**:
A Skill that connects two Positions the user is trying to join — either
repairing a break in the middle of a Sequence, or closing one into a Loop.

**Ground state**:
A Position a discipline keeps returning to, from which most Skills depart and
to which most return. Cascade in juggling; standing in acro.

**Isolated position**:
A Position with no Skill touching it in either direction — a shape the user can
name but cannot yet get into or out of. The Map view calls these out as the
gaps in the user's vocabulary.
_Avoid_: orphan, unused, dead node

### Practice

**LogEntry**:
One attempt at one Skill on one day. Entries are the record of what actually
happened and are never derived from anything else.
_Avoid_: session, rep, attempt, practice

**Discipline**:
Which of the two activities something belongs to — juggling or acro. Every
Position, Skill, Sequence and LogEntry belongs to exactly one, and the graph
never has an edge crossing between them.

**Status**:
How far along a Skill is: **want** → **working** → **got**. A convenience
summary that the user sets by hand; the LogEntries are the actual record.
_Avoid_: level, progress, stage

**Role**:
Which part the user took in an acro Skill — base, flyer or spotter. The same
Skill in a different Role is a different thing to have learnt.

**Felt**:
A 1–5 self-report of how an acro attempt went. Acro's answer to the question
juggling answers with counts.
_Avoid_: rating, score, quality

**Partner**:
The person the user did an acro Skill with, recorded by name. A Skill you have
with one partner is not a Skill you have with everyone.

### Juggling specifics

**Siteswap**:
The numeric notation describing a juggling pattern's throws — `441`, `531`,
`(4,2x)(2x,4)`. Acro has no equivalent.

**Prop count**:
How many objects a juggling Skill uses.
_Avoid_: balls, objects

**Run**:
The number of consecutive catches in one uninterrupted attempt. "Best run" is
the longest one in a session — the juggling measure of how it went.

### The app

**Deck**:
Everything the user has recorded — every Position, Skill, Sequence and LogEntry,
both disciplines together — held as one local copy the app renders from and
Supabase replicates. The app is local-first, so the deck is the authority and
the server is the replica; "Loading your deck…" is the one state where no local
copy exists yet.
_Avoid_: data, database, collection, library
