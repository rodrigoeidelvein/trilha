-- Skills are total edges, and positions cannot be deleted out from under them.
-- See docs/adr/0003-skills-are-total-edges.md and
-- docs/adr/0023-a-position-name-is-unique-after-aggressive-normalisation.md.
--
-- Written while all four domain tables were empty and auth.users had no rows,
-- so there is nothing to backfill and nothing to deduplicate.

-- 1. An edge with a missing endpoint is not an edge, and a LogEntry is an
--    attempt at one specific edge.
alter table public.skills
  alter column from_position set not null,
  alter column to_position set not null;

alter table public.logs
  alter column skill_id set not null;

-- 2. Deleting a Position that still has edges is refused rather than cascading.
--    logs -> skills stays ON DELETE CASCADE deliberately: an orphan LogEntry is
--    meaningless, so deleting a Skill takes its history with it.
alter table public.skills
  drop constraint skills_from_position_fkey,
  add constraint skills_from_position_fkey
    foreign key (from_position) references public.positions(id) on delete restrict;

alter table public.skills
  drop constraint skills_to_position_fkey,
  add constraint skills_to_position_fkey
    foreign key (to_position) references public.positions(id) on delete restrict;

-- 3. "hip key", "Hip Key" and "hipkey" are one node. lower(name) alone catches
--    only the case drift, so index the aggressive normalisation: lowercase,
--    then strip everything that is not a-z0-9.
create unique index positions_user_disc_name
  on public.positions
  using btree (user_id, discipline, regexp_replace(lower(name), '[^a-z0-9]', '', 'g'));
