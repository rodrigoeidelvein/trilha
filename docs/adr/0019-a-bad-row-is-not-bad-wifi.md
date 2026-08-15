# A bad row is not bad wifi

`pull()` wraps the fetch and the mapping in one `try` (`app.js:111`–`125`) and
reports everything that escapes it as "Could not reach Supabase. Working from
cache."

ADR-0002 narrows types at the mapper, and #4 settled that a row violating a
narrowed type throws. So the app's response to a malformed row is to tell the
user their wifi is bad. They will go and stand nearer the window, and it will
say the same thing, and the local copy will keep rendering, so nothing will ever
prompt them to look at the data. This is the loose end #4 recorded and handed
here.

Two failures, two messages:

- **Transport.** Expected, transient, and the reason the app is local-first:
  "Offline — showing your local copy", with a way to try again.
- **A row the domain says cannot exist.** A bug in the data or a schema change
  that outran the types. Named as such, with the table and the id, so it can be
  fixed in the Supabase dashboard.

The point of separating them is not precision for its own sake. The offline
message is the one you learn to ignore, because it is usually right and usually
resolves itself. Anything folded into it inherits that. A mapper throw is rare
and always actionable, and it has to arrive somewhere the user has not already
been trained to dismiss.

## Consequences

**The seam is where the `try` goes, not new machinery.** The mapper runs after
the fetch resolves, so the two are already separable — mapping moves out of the
block that catches the network.

**A mapper throw is not recoverable in the app**, and the message should not
imply otherwise. The deck keeps rendering from the local copy; the fix happens
in the database.

**The failed pull gets the same affordance the Unsent badge has** (ADR-0014).
`pull()` runs once, at boot (`app.js:548`), and the prototype offers no retry
short of a reload — which on a phone means finding the tab again. One tap
should re-run it.
