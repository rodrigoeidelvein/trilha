# Hue is a root attribute and status is a token ramp

`src/styles/tokens.css` and `src/styles/base.css` are plain global stylesheets,
imported once in `main.tsx`. Everything else is a co-located CSS module. The
runtime discipline swap stops being a JS style write and becomes one selector,
`:root[data-discipline="acro"]`. Status intensity stops being three unrelated
hand-tuned numbers and becomes three tokens.

The two files are global because there is nothing in them to scope. `:root`,
`body`, `button`, `:focus-visible` and the custom properties themselves are
global by nature — a module would hash the class names and leave every one of
those declarations exactly where it was. Their real job is the opposite of
scoping: `tokens.css` is **the one file where a literal colour is allowed**,
which is what makes "never hardcode a hex value in a component" a rule you can
actually follow rather than a rule with no escape hatch.

## What was missing from the prototype's custom properties

`--ink`, `--surface`, `--surface2`, `--line`, `--chalk`, `--muted`, `--juggle`,
`--acro`, `--warn`, `--hue` and `--r` all survive as tokens unchanged. Auditing
`styles.css` for values that *should* have been tokens and were not:

| New token | Was |
|---|---|
| `--on-hue` | `#0C1116`, hardcoded on the primary button (`styles.css:56`) — the only ink-on-hue value in the app |
| `--warn-line` / `--warn-wash` | `rgba(255,122,107,…)` written out three times (`:117`, `:139`, `:147`) — `--warn` existed but its two derived shades did not |
| `--scrim` | `rgba(8,12,16,.7)` (`:132`). Kept as a literal, because it is genuinely darker than `--ink` and is *not* a mix of it |
| `--font` / `--font-mono` | the two family stacks, spelled out nine times between them |
| `--r-xs`, `--r-lg`, `--r-pill` | `5px`, `8px`, `14px`, `16px`, `99px` — only the 10px `--r` was ever a token |

**Font sizes are deliberately not tokenised.** `styles.css` uses about fourteen
distinct sizes between 11.5px and 34px, most of them once. A type scale is
exactly the over-abstraction this ticket was right to suspect: it would replace
fourteen numbers that sit next to the thing they size with fourteen names that
do not, and the app is four views for one person.

## The swap is an attribute because of who writes it, not what it renders

Both mechanisms set `--hue` on `:root` and nothing downstream can tell them
apart — the prototype drives the same page either way and the computed `--hue`,
every card border and every SVG stroke come out identical. So the choice is
made on other grounds:

- It is one line of CSS instead of an effect that reaches out of React's tree to
  poke `documentElement.style`. There is still exactly one imperative DOM write
  — an effect at the root setting `dataset.discipline` from `useUi` — but it
  writes a *fact*, not a *style*, and the stylesheet decides what that fact
  means.
- `<html data-discipline="acro">` is legible in devtools and assertable in a
  test. `element.style` holding `var(--acro)` is neither.

The indirection is preserved: `--hue: var(--acro)`, not `--hue: #2FD9C4`. Moving
`--acro` still moves everything downstream, which is the property that made the
prototype's trick work in the first place.

## One ramp, three rungs, and the recipe stays local

```css
--i-want:22%; --i-working:55%; --i-got:100%;
```

Percentages, not numbers, because a percentage is valid **both** as a
`color-mix()` proportion and directly as `stroke-opacity` — verified in Chrome
151, where `stroke-opacity:var(--i-want)` resolves to `0.22`. One token
therefore serves a card border and an SVG stroke without a `calc()` in between.

The tokens carry the **rung**, not the **recipe**. A card says the working rung
with a border colour, the Map says it with a stroke opacity, the legend says it
with a swatch. That distinction is what stops this being over-abstraction: the
alternative is not "three simple local rules", it is the same three numbers
written in three files, which is what the prototype does and where it had
already drifted — the legend's `.35 / .6 / 1` does not match the map's
`.22 / .55 / 1`.

Two consequences of adopting one ramp:

- **The legend changes, deliberately.** Porting it onto the ramp moves its want
  swatch from `.35` to `.22` and working from `.6` to `.55`. This is the one
  place strict parity is broken on purpose, because a legend that does not match
  the thing it explains is a bug that happens to be pretty.
- **The card's `want` rung is left alone, and is the real inconsistency.** It
  has no hue in it at all — dashed `--line` plus `opacity:.72` — where every
  other surface expresses `want` as a faint hue. Parity keeps it. It is written
  down here because it is the one place the design system does not do what it
  says it does, and the next person to touch it should know it is a known
  exception rather than a pattern to copy.

`got` is written `var(--hue)`, not a 100% mix, because at the top of the ramp
the mix is the identity function.

## Consequences

**Class names are free.** The prototype was built with hand-hashed names
(`._card_k3f9`) to prove the point: nothing outside a module reads a module's
class names, so the modules can hash freely. What crosses the boundary is
`--hue` and the ramp, and those are global on purpose.

**Status becomes a data attribute, not a class name.** `.st-want` becomes
`[data-status="want"]` on the same element, so a component passes `status`
straight through instead of composing a class string, and the Map can key off
the identical attribute. This is what lets one module and one SVG share one
encoding.

**`.mono` disappears into `--font-mono`, and that fixes a latent bug.**
`styles.css` spells the mono stack two different ways — `.mono` includes the
`ui-monospace` fallback, while `.ss`, `.card .path`, `.count` and `.entry .when`
do not. One token means one stack. Computed styles differ from the prototype by
exactly this, and the difference is the fix.
