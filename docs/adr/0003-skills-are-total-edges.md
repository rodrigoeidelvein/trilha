# Skills are total edges, and positions cannot be deleted out from under them

A Skill is a directed edge. An edge missing an endpoint is not a degenerate
edge — it is not an edge — so `skills.from_position`, `skills.to_position` and
`logs.skill_id` are `NOT NULL` in the schema and non-nullable in the domain,
and the two `skills → positions` foreign keys are `ON DELETE RESTRICT`.

The schema originally allowed all three to be null and cascaded deletes from
positions through skills and on into logs, so removing one node could silently
destroy years of log history. The alternatives were to admit `null` in the
domain — which grows a branch in every graph function for a state that should
not exist — or to keep the schema loose and have the mapper handle a null the
type claims is impossible. Both were rejected: the tables were empty and no
user had ever signed in when this was decided, so tightening cost nothing then
and only gets more expensive.

## Consequences

A Skill cannot be created before the Positions it connects exist, so the app
must require at least one Position before offering to add a Skill. Deleting a
Position that still has edges is refused rather than cascading. `logs → skills`
stays `ON DELETE CASCADE` on purpose — a LogEntry is an attempt at one specific
edge, so an orphan entry is meaningless — which means deleting a Skill takes
its history with it and the UI owes the user a count before it does.
