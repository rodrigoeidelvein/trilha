# Graph functions take plain arrays and never see discipline

Every function in `src/domain/graph.ts` takes a plain `Skill[]` (and where it
needs nodes, a plain `Position[]`) as its first argument, returns plain data,
and holds no state between calls. There is no `Graph` value to construct, no
adjacency index, and no `Discipline` anywhere in the module — `graph.ts` does
not import the type.

The prototype's `analyse(ids)` reads the module-global `DB` to turn ids into
skills and `bridges(a, b)` reads both `DB` and the global `disc`; neither can
move into `domain/` unchanged. The two candidate replacements were an index
built once per render — `buildGraph(positions, skills)` returning outgoing and
incoming maps — or passing the raw arrays. The index was rejected: it is
infrastructure for a problem this app does not have. One user's deck is tens of
positions and low hundreds of skills, every query here is a single filter, and
an index buys nothing but a staleness question the caller then has to answer.

Discipline leaves the module rather than becoming a parameter. ADR-0004 already
routed all per-discipline reads through one selector instead of the prototype's
nine open-coded filters, and adding a `discipline` argument to `bridges` would
put the tenth back. The sharper reason is that "no edge ever crosses between
disciplines" means the thing these functions operate on *is* one discipline's
subgraph; a function that has to be told which discipline it is looking at has
been handed the wrong data.

## Consequences

**The single-discipline precondition is stated, not checked.** Every function
assumes the skills it receives are one discipline's, and none of them verify it.
Handing `analyseSequence` a mixed list produces an answer about a graph that
does not exist. This is the module's one unenforced precondition and it belongs
in a comment at the top of the file — the enforcement lives in the store
selector, which is the only thing that ever builds these lists.

**Tests need no fixtures, no store, and no mocks.** A test is a literal array of
skill objects and an expected value. This is the whole point of the rule that
`src/domain` imports from nowhere else, and it is why the signatures were chosen
this way rather than for elegance.

**Later graph functions inherit the shape.** `findLoops(skills)` and
`reachableFrom(skills, from)` — roadmap item 2's territory, deliberately not
shipped in the port — take the same first argument and slot in without touching
an existing signature. That shared first parameter is the only forward
compatibility the module needs.
