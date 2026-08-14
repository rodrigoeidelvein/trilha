# The webfont is self-hosted

Space Grotesk and Space Mono are bundled with the app instead of fetched from
Google Fonts. The two `<link rel="preconnect">` tags and the stylesheet `<link>`
come out of `index.html`; the faces come in through `@fontsource/space-grotesk`
and `@fontsource/space-mono`, imported once next to `tokens.css`.

The prototype's `index.html` blocks first paint on a request to
`fonts.googleapis.com`, which then triggers a second request to
`fonts.gstatic.com` for the files themselves. That is two third-party round
trips on the critical path of an app whose entire premise is that it opens
instantly in a gym with bad wifi and renders from `localStorage`. The store is
local-first precisely so the network cannot make the app unusable; leaving the
typography on a CDN puts the network back in front of the first frame.

`display=swap` does not settle it, it just moves the damage. Killing the webfont
in the prototype shows the layout holds — nothing is sized off the font — but
the monospaced columns lose their alignment: the siteswap chips, the counts, the
`from → to` paths and the log's dates are all mono *because* they are meant to
line up when scanned. Swapping those in after first paint reflows exactly the
columns the design uses for reading.

## The dependency

Two build-time dependencies, no runtime code. `CLAUDE.md` asks what a dependency
replaces: hand-downloading five `woff2` files (Grotesk 400/500/700, Mono
400/700 — the weights `styles.css` actually uses), writing the `@font-face`
blocks, dropping them in `public/`, and doing it again by hand whenever a weight
is added. Fontsource ships the same files as an npm package with the
`@font-face` rules written, and because they are imported rather than sat in
`public/`, Vite fingerprints and hashes them like any other asset and they are
served from the repo's `base` path.

That is a fair trade for a hobby app, and it is reversible in one commit if it
ever stops being one.

## Rejected

**Keep the `<link>`.** The thing being fixed.

**A system stack, no webfont at all.** The cheapest option, and it changes the
design rather than porting it. Space Grotesk *is* the wordmark, and the mono
columns are load-bearing for scanning. Strict parity rules it out.

## Consequences

**The app renders correctly offline after first load**, which the prototype does
not — the fonts are in the same cache as everything else, not on an origin the
service worker never sees and the gym wifi may not reach.

**`index.html` stops carrying design decisions.** After this it holds the
viewport meta, the theme colour, and the root div. Everything about how the app
looks lives under `src/styles`.
