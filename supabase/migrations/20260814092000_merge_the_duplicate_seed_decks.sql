-- Merge the duplicate seed decks.
--
-- On 2026-08-14 at 18:07:26, seed() ran twice about 2ms apart and inserted the
-- whole starter deck twice: 34 positions and 64 skills, where each generation's
-- skills point only at its own generation's positions. Two disjoint copies of
-- the same graph. Both copies were then used, so six juggling skills carry a
-- different status on each side, in both directions.
--
-- seedRemote() (app.js:195) is a check-then-act — pull(), and seed if the deck
-- came back empty — with nothing in the database to refuse the second write.
-- The unique index in the next migration is what closes that: a second seed now
-- fails on the first position instead of silently doubling the deck.
--
-- This is a one-off repair for that specific accident. It is a no-op on a
-- database that never had it.

-- 1. Positions merge on the normalised name, which is the rule the next
--    migration is about to enforce. The survivor is the earliest row.
create temporary table position_merge as
with survivor as (
  select distinct on (user_id, discipline, regexp_replace(lower(name), '[^a-z0-9]', '', 'g'))
         id, user_id, discipline,
         regexp_replace(lower(name), '[^a-z0-9]', '', 'g') as norm
    from public.positions
   order by user_id, discipline, regexp_replace(lower(name), '[^a-z0-9]', '', 'g'),
            created_at, id
)
select p.id as dup_id, s.id as keep_id
  from public.positions p
  join survivor s
    on s.user_id = p.user_id
   and s.discipline = p.discipline
   and s.norm = regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g')
 where s.id <> p.id;

-- 2. Point every edge at the surviving endpoints. This is what turns the second
--    generation's skills into true duplicates of the first's.
update public.skills k
   set from_position = m.keep_id
  from position_merge m
 where k.from_position = m.dup_id;

update public.skills k
   set to_position = m.keep_id
  from position_merge m
 where k.to_position = m.dup_id;

-- 3. Skills merge on the exact name plus both endpoints — not the normalised
--    name. These are byte-identical seed rows that have collided, so an exact
--    match repairs the accident without ever merging two Skills the user
--    actually meant to keep apart.
create temporary table skill_survivor as
select distinct on (user_id, discipline, name, from_position, to_position)
       id as keep_id, user_id, discipline, name, from_position, to_position
  from public.skills
 order by user_id, discipline, name, from_position, to_position, created_at, id;

create temporary table skill_merge as
select s.id as dup_id, v.keep_id
  from public.skills s
  join skill_survivor v
    on v.user_id = s.user_id
   and v.discipline = s.discipline
   and v.name = s.name
   and v.from_position = s.from_position
   and v.to_position = s.to_position
 where v.keep_id <> s.id;

-- 4. The more advanced status wins. There is no updated_at on skills, so
--    nothing in the data says which edit is newer; want < working < got is the
--    only rule the rows support, and it is the forgiving one — a Status is a
--    convenience summary the user can retap, and you do not un-learn a Skill.
--    Every other differing column keeps the survivor's value.
update public.skills k
   set status = b.best
  from (
    select v.keep_id,
           (array['want', 'working', 'got'])[
             max(case s.status when 'got' then 3 when 'working' then 2 else 1 end)
           ] as best
      from public.skills s
      join skill_survivor v
        on v.user_id = s.user_id
       and v.discipline = s.discipline
       and v.name = s.name
       and v.from_position = s.from_position
       and v.to_position = s.to_position
     group by v.keep_id
  ) b
 where k.id = b.keep_id
   and k.status <> b.best;

-- 5. Saved Sequences hold skill ids in a uuid[] with no foreign key, so nothing
--    would have told them their Skills went away. There are none today; this
--    keeps the script correct rather than lucky.
update public.sequences q
   set skill_ids = (
     select array_agg(coalesce(m.keep_id, x.id) order by x.ord)
       from unnest(q.skill_ids) with ordinality as x(id, ord)
       left join skill_merge m on m.dup_id = x.id
   )
 where exists (
   select 1 from unnest(q.skill_ids) as t(id)
     join skill_merge m on m.dup_id = t.id
 );

-- 6. Drop the duplicates. Skills first: the foreign keys are still ON DELETE
--    CASCADE until the next migration, and nothing should ride a cascade here.
delete from public.skills where id in (select dup_id from skill_merge);
delete from public.positions where id in (select dup_id from position_merge);

drop table skill_merge;
drop table skill_survivor;
drop table position_merge;
