# The auth gate is a branch above the router

`App` reads one auth phase — `unknown`, `signedOut`, `signedIn` — and renders
one of three things: the loading screen, the Gate, or `<HashRouter>` plus the
shell. The router is mounted only in the signed-in branch. There is no
`/signin` route, no `<RequireAuth>` wrapper, and no auth store.

A route guard answers "which routes need a session". Here every route does, and
the app has no public surface to navigate a signed-out user *to*, so the guard
would be a component that renders the same redirect on all four routes. The Gate
is not a place you go; it is the phase the app is in before it has a session,
which is what a branch expresses. Magic-link sign-in has no post-login redirect
to preserve either — the link comes back to the app root and the session
arrives through `onAuthStateChange`, so there is no "where were they going"
state that a route-based gate exists to carry.

**Mounting the router only after the phase resolves also keeps Supabase out of
the route.** Under supabase-js's default implicit flow the magic link returns
with the session in the URL *fragment* — `#access_token=…&refresh_token=…` —
and under `HashRouter` the fragment **is** the route. The library then strips it
with `history.replaceState`, which fires no `hashchange`, so a router that
mounted first would be looking at a path that no longer exists in the address
bar. So the client is created with `flowType: 'pkce'`: the link comes back with
`?code=…` in the query string, `detectSessionInUrl` exchanges it, and the hash
is never touched. Mounting after the phase resolves and ADR-0008's `*` redirect
are the second and third layers; the flow choice is the one that removes the
collision rather than sequencing around it.

`start(session)` (`app.js:542`) does five things in one function. They land in
five different places, and that decomposition is most of this decision:

| Prototype | Lands in |
|---|---|
| `user = session.user`, hide gate, show app | the phase branch — React re-renders |
| `readCache()` | Zustand `persist` rehydration, before React mounts |
| first `render()` | React |
| `await pull()` | one store action, fired by an effect in the signed-in branch |
| conditional `seedRemote()` | inside that same action — it is a data decision, not a shell one |

## Consequences

**The boot action must be idempotent, or first run seeds twice.** Seeding is
guarded by `positions.length === 0`, which two concurrent pulls both pass —
and React 19's StrictMode runs effects twice in dev, so this is not a
hypothetical. The action returns early if a boot is already in flight. Naming
the flag is #8's, since it owns the store's status field.

**Seeding stays gated on a *successful* pull**, as it is today. Seeding after a
failed pull would write a second full deck over whatever the server already has
the next time the network works.

**"Loading your deck…" is not the auth phase.** `persist` rehydrates
synchronously from `localStorage`, so a returning device has its deck before
the first paint and goes straight to the views. The placeholder is only for a
device that has never synced — empty cache, first pull in flight — and every
view already carries its own empty state for the rest.

**No auth store, because almost nothing needs the session.** Its consumers are
the branch, the sign-out button, and the effect that fires the boot action.
Writes do not need the user id: #4 kept `user_id` out of the domain and out of
`toRow` because the column defaults to `auth.uid()` and RLS's `WITH CHECK`
guarantees it. So the session is React state at the root, and `push`/`remove`
lose the `if (!sb || !user) return` that the prototype needs (ADR-0010 removes
the other half).

**Sign out clears the persisted keys and reloads.** A hard reload is the only
reset that cannot leave a store holding the previous session's deck, and the
cost of it in a single-user app is one page load.

**Two things for the human, both #9's to schedule.** The redirect URL has to be
on the project's allow-list in Supabase Auth settings — the deployed Pages URL
and `http://localhost:5173` — or the link bounces. And PKCE requires the link to
be opened in the same browser that requested it, because the code verifier is
in that browser's storage. The Gate's own copy already tells the user that
("opening it on this device signs you in here"), and the flow is per-device by
design. If cross-device sign-in is ever wanted, the fallback is the implicit
flow plus normalising the hash before the router mounts.
