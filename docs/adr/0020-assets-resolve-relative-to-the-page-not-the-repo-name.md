# Assets resolve relative to the page, not the repo name

`base` in `vite.config.ts` is `'./'`. The build emits `./assets/index-<hash>.js`
rather than `/trilha/assets/index-<hash>.js`, and every asset URL resolves
against the document that loaded it. Nothing in the build knows what the repo is
called or where on the origin it is mounted.

`CLAUDE.md` carried the opposite rule — `base` must match the repo name — and
gave the value as `/trilha-app/` for a repo named `trilha`. The rule and its
example had already drifted apart before a single line of the app existed. That
is the whole argument: a constant that must be kept equal to a name stored
somewhere else, whose only failure mode is a fully-deployed site where every
asset 404s and nothing renders, is a coupling worth deleting rather than
documenting more loudly.

`HashRouter` is what makes deleting it safe (ADR-0008). The document URL is
always `…/trilha/index.html`; the route lives after the `#` and never changes
the path the browser resolves relative URLs against. There is no deep path for a
relative URL to be wrong at, because there are no deep paths.

## Verified, not assumed

Built the same app twice — `base: './'` and `base: '/trilha/'` — and served both
over HTTP from a subdirectory:

| | `'./'` | `'/trilha/'` |
|---|---|---|
| `index.html` | `./assets/index-<hash>.js` | `/trilha/assets/index-<hash>.js` |
| `@font-face` in the bundled CSS | `url(./x-<hash>.woff2)` | `url(/trilha/assets/x-<hash>.woff2)` |
| `new URL('…', import.meta.url)` | `"dot-<hash>.png"` | `"/trilha/assets/dot-<hash>.png"` |
| Served at `/trilha/` | all 200 | all 200 |
| Served at `/trilha-renamed/` | all 200 | **404** |

Then loaded the relative build in headless Chrome at a mount path it was not
built for, on a hash route: entry chunk, CSS, the `woff2` behind `@font-face`,
the lazily-imported route chunk and the `import.meta.url` image all returned
200, with no console errors and no failed requests. The three mechanisms that
could plausibly have needed an absolute base — bundled CSS `url()`, dynamic
`import()`, and `new URL(…, import.meta.url)` — all emit page-relative URLs and
all resolve.

Vite's dev server is unaffected: it serves from `/` regardless, and `bun dev`
behaves identically under either value.

## Rejected

**`base: '/trilha/'`.** Correct today, and correct only for as long as nobody
renames the repo. It also makes `bun run preview` serve at
`localhost:4173/trilha/` rather than the root, which is a small daily tax for a
value that exists to satisfy one host.

**Renaming the repo to `trilha-app`.** Fixes the documentation by moving the
world to match it. The repo is called `trilha`, the project is called Trilha,
and the URL `rodrigoeidelvein.github.io/trilha` is the one already live.

## Consequences

**The gotcha in `CLAUDE.md` is deleted, not corrected.** Renaming the repo now
changes the URL and nothing else; the next build works untouched.

**The favicon must be declared in `index.html` with a relative `href`.** A
browser with no `<link rel="icon">` asks the *origin root* for `/favicon.ico`,
which on Pages is not this project. That request 404s today under the prototype
too — it is the one URL a relative base cannot fix on its own.

**A service worker or a PWA manifest would reopen this.** Both are resolved
against paths rather than the document, and a service worker's scope is fixed at
registration. Neither is planned; if one arrives, this ADR is the thing to
re-read.
