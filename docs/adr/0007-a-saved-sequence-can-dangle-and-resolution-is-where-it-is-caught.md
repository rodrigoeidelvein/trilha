# A saved Sequence can dangle, and resolution is where it is caught

`sequences.skill_ids` is a bare `uuid[]` with no foreign key
(`supabase/schema.sql:135`), and deleting a Skill clears it only from the
in-progress chain (`app.js:478`), never from saved Sequences. So a saved
Sequence can hold the id of a Skill that no longer exists. This is the one place
in the model where a reference can dangle; ADR-0003 closed the equivalent hole
for Skills and LogEntries, but a Postgres array cannot carry a foreign key and
so could not be closed the same way.

Cleaning saved Sequences on delete helps but does not settle it: two devices and
a local-first store mean the phone can save a Sequence containing a Skill the
laptop has already deleted. **The domain has to tolerate a dangling id arriving.
It does not have to tolerate resolving one silently.**

The prototype does exactly that, and the failure is worse than a missing entry.
`ids.map(skill).filter(Boolean)` (`app.js:290`) does not merely drop the missing
Skill — it *closes the gap*, so `[A, B, C]` with `B` deleted becomes `[A, C]`
and the Build view reports connectivity for a Sequence the user never built. If
`A.to === C.from` it says **"Valid sequence"** about something that is not the
saved Sequence at all.

Resolution therefore moves out of the graph functions and becomes explicit:

```ts
resolveSequence(skillIds: SkillId[], skills: Skill[]): {
  skills: Skill[];
  missing: SkillId[];
}
```

The two rejected alternatives were keeping the silent drop, and admitting the
hole into the domain as `(Skill | null)[]`. The second is the one worth
recording as rejected: it is honest, but it grows a null branch in every graph
function for a state that only ever arises at one call site, which is the
trade ADR-0003 already refused for edges. Resolving at the boundary and keeping
the graph functions total over `Skill[]` mirrors ADR-0002's mapper, where the
database's permissiveness is resolved once so the domain can stay narrow.

## Consequences

**Only one call site can produce a `missing` list.** The live chain is built by
clicking Skills that exist and is already pruned on delete, so it is resolved by
construction. Loading a saved Sequence is the only place `resolveSequence` has
anything to report, and it is where the Build view owes the user a sentence —
"2 of the 5 Skills in this Sequence no longer exist" — instead of quietly
loading a shorter chain.

**`missing` returns ids rather than a count** even though a deleted Skill has no
name left to show. The count is what the sentence needs; the ids are what a
repair needs, so the view can offer to strip exactly those entries from the
saved row. Whether the port offers that repair is a Build-view question and is
left open — the return shape does not foreclose it.

**`resolveSequence` lives in `graph.ts`** rather than a new `domain/sequence.ts`.
It is not graph traversal, but splitting one pure function into its own file to
satisfy a taxonomy is the abstraction-for-its-own-sake the working agreement
rules out. `graph.ts` is what the Build and Map views need to know about the
graph, and this is the first thing Build needs to know.
