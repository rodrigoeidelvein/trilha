# The URL holds the view and nothing else

The four views are the four routes — `#/skills`, `#/log`, `#/build`, `#/map` —
and `view` stops being a store field. Everything else the prototype keeps in a
module global stays in `useUi`, persisted: `discipline`, the Build chain, and
the Skills board/list mode. Nothing else goes in the URL, and there is no route
for a sheet.

`CLAUDE.md` gave routing exactly one job: the phone back button. That is a
statement about *places*, and the four views are the only places this app has.
It also listed `view` in `useUi`, which cannot both be true — a route and a
store field for the same fact means two writers and one of them wins silently.
The route wins, because it is the one the back button can see.

**Discipline is a mode, not a place.** It was the real question here, since it
is a bigger context switch than the view: it swaps `--hue`, filters every list,
and decides which half of the deck exists. Three things settle it against the
URL. It has to survive a cold start — you open the app at the gym on an acro
day and it must already be acro, and a URL that nobody bookmarks and nobody
shares cannot carry that, so the store would have to hold it anyway and then be
reconciled against the path. Back would stop meaning "the view I was just on"
and start meaning "the last thing I touched", so a Juggling→Acro→Log→Map trail
takes four presses to unwind, two of which repaint the whole app. And every
internal link would have to carry the current discipline, which makes `/log` a
string to compute rather than a constant.

The rule the rest of the shell follows from that: **links change where you are,
buttons change what you are doing.** The nav is four `NavLink`s and gets
`aria-current="page"`; the discipline toggle and the board/list toggle stay
buttons with `aria-pressed`, which is also why both are the same `Seg`
primitive and the nav is not.

Placement for everything the prototype held in a global, by the question "what
would be wrong if this were lost":

| | Lives in | Lost when |
|---|---|---|
| `view` | the URL | never — it is the URL |
| `discipline` | `useUi`, persisted | never |
| `boardMode` | `useUi`, persisted | never |
| `chain` | `useUi`, persisted, keyed by discipline | explicitly cleared |
| sheet open / which skill | component state | you leave the view |
| felt rating, form inputs | component state | you leave the view |

## Consequences

**Switching discipline no longer throws away the chain.** `chain` becomes
`Record<Discipline, SkillId[]>` and the Build view reads the current
discipline's entry, so the prototype's unconditional clear on toggle
(`app.js:435`) is deleted rather than relocated. This is the one deliberate
behaviour change in the port: the clear existed because one global could only
hold one discipline's work, and a mis-tap on a header toggle that silently
destroys unsaved work is not a feature worth porting. `clearChain` stays as an
explicit button.

**A persisted chain can dangle, which amends ADR-0007.** That ADR observed that
the live chain is "resolved by construction" because it is built by clicking
Skills that exist and pruned on delete. Persisting it breaks that: the chain now
outlives a reload, and `pull()` overwrites the whole deck at the next boot, so a
Skill deleted on the laptop disappears under the phone's saved chain with no
local delete to hook a prune onto. So the Build view resolves the live chain
through `resolveSequence` exactly as it resolves a loaded Sequence, `missing` is
meaningful for both, and `app.js:478`'s `chain = chain.filter(...)` is deleted
too — one path instead of a prune that could never have covered the remote case.
ADR-0007's decision is unchanged and its return shape is what makes this cheap.

**The unmatched route redirects rather than 404s.** `*` renders
`<Navigate to="/skills" replace />`, which covers `/` on first open and any
stale hash. `replace` matters: without it the discarded entry sits in history
and back bounces off it.

**No data router, no loaders.** `<HashRouter>` with plain `<Routes>`. Data comes
from the store, so a loader would be a second data path into the same views for
an app whose data is already in memory before the router mounts.

**Sheets are component state, and this is the decision to reopen first.** On a
phone, back is a reasonable way to dismiss a modal, and here it will leave the
view instead. Both options lose whatever was typed, the sheet already has three
dismissals (Cancel, Escape, scrim tap), and routing them would double the route
table and add a `/skills/:id` that can point at a deleted Skill. If the phone
feels wrong in practice, this is one file to change.
