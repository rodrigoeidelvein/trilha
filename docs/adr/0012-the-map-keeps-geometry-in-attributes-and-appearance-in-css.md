# The Map keeps geometry in attributes and appearance in CSS

The Map's SVG elements carry **geometry** as presentation attributes and
**appearance** as a CSS module class plus `data-status`. Every presentation
attribute that describes how something looks — `stroke`, `fill`,
`stroke-opacity`, `stroke-width`, `stroke-dasharray`, `font-family`,
`font-size` — is deleted, and the JS opacity table at `app.js:350` goes with
them.

This was called the hard case because presentation attributes are not
CSS-module-scoped, which made it look like the Map would have to keep its own
copy of the status encoding while every other view read tokens. It does not,
and the reason is a cascade rule rather than a workaround.

## Presentation attributes lose to any author rule

They sit below the author stylesheet in the cascade — below even a single class
selector. Driving the prototype with both encodings present at once, where the
attributes claimed every edge was `got` (full opacity, 2.2px, solid) and the
module class said otherwise, the class won on all four properties
simultaneously: `stroke-opacity` `0.22`, `stroke-width` `1.5px`,
`stroke-dasharray` `4px, 4px`, `stroke` the hue rather than the attribute's red.

So there is no specificity war to lose, and no `!important` anywhere. It also
means a **half-finished port is not ambiguous** — while both encodings are in
the file the CSS is simply what renders, so the attributes can be deleted in a
follow-up pass rather than in the same commit.

Rendering is otherwise identical between the two encodings — the same
`.22 / .55 / 1` opacities, the same `1.5` and `2.2` widths, the same `4 4` edge
and `3 3` self-loop dash patterns — so this is a parity-preserving change.

## Where the line falls

**If it changes when the discipline or the status changes, it is CSS. If it
changes when the graph changes, it is an attribute.**

Geometry stays in JS and stays in attributes, because geometry is data: the
circular layout, `cx`/`cy` from the angle, the node radius grown from how many
Skills touch the Position, the quadratic control point that bows an edge off the
straight line, `text-anchor`. None of it belongs in a stylesheet and none of it
is expressible there.

Appearance moves. `stroke="var(--hue)"` becomes `.edge { stroke: var(--hue) }`.
The status ramp arrives through `data-status`, exactly the attribute the Skills
cards use, so `.edge[data-status="want"] { stroke-opacity: var(--i-want) }` and
the card's dashed border are two readings of one token. The node's "does this
Position have anything solid on it" becomes `data-solid`, replacing a ternary
that inlined `var(--hue)` or `var(--surface2)` into a `fill` attribute.

`font-family="Space Grotesk"` is deleted outright rather than moved: `font-family`
is inherited, and SVG `<text>` inherits it from `body` like anything else —
verified, the label computes to the full `--font` stack with no rule naming it.

`<title>` children stay. They are content, not presentation, and they are what
makes the graph legible to a screen reader and hoverable with a tooltip.

## Consequences

**The status encoding stops existing twice.** `const opa = { want: .22,
working: .55, got: 1 }` was a second, invisible copy of the design system living
in a view file, where no stylesheet could see it and nothing kept it in step
with the cards. Deleting it is the actual payoff of this ADR — the tokens in
ADR-0011 are only "one set" if the Map reads them, and now it does.

**The Map view gets a `Map.module.css` like every other feature.** Before this
decision it was the one view whose styling could not be co-located, which would
have made it a permanent exception to the layout in `CLAUDE.md`.

**Discipline switching is now free on the Map too.** Nothing about the swap
touches the SVG: `--hue` moves on `:root` and the strokes follow, so the Map does
not re-render to change colour.
