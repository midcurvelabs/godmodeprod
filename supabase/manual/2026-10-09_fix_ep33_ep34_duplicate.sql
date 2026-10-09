-- GMP docket numbering fix (godmodeprod Supabase, project gadukqyiyamnwgmarsdf), 2026-10-09.
-- Row "EP 33" (1a3ecb18) = the show's EP33, holds only the Claude Code 5-hour card.
-- Row "EP 34" (25eb5b34, recording 2026-10-01) = duplicate, holds the other 18 EP33 cards.
-- Row "EP 35" (f990d205, recording 2026-10-08) = the show's EP34.
-- Fix: move every row that points at 25eb5b34 to 1a3ecb18, delete 25eb5b34, renumber f990d205 to 34.
-- Same pattern as migrations/00007_move_ep13_to_ep12.sql, but pinned to ids (numbers change mid-script)
-- and covering every FK to episodes(id), so `on delete cascade` can never take a child row with it.

-- ── STEP A: read-only pre-check (run first, paste me the output) ──────────────────────────────
select id, episode_number, title, status, recording_date, created_at
from episodes
where id in ('1a3ecb18-176d-4d86-a599-5a6b66058b4a', '25eb5b34-e377-4c98-b90e-83ea3ccaebb8', 'f990d205-67ea-4322-a6fc-609a99727af2')
order by episode_number;

-- child rows per table for the three episodes (generated from the live FK list)
select format(
  'select %L as tbl, episode_id, count(*) from public.%I where %I in (%L,%L,%L) group by episode_id',
  tc.table_name, tc.table_name, kcu.column_name,
  '1a3ecb18-176d-4d86-a599-5a6b66058b4a', '25eb5b34-e377-4c98-b90e-83ea3ccaebb8', 'f990d205-67ea-4322-a6fc-609a99727af2')
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and ccu.table_name = 'episodes' and ccu.column_name = 'id';
-- (run the generated statements, or I union them for you)

-- ── STEP B: the fix, one transaction ─────────────────────────────────────────────────────────
begin;

do $$
declare
  ep33 uuid := '1a3ecb18-176d-4d86-a599-5a6b66058b4a';
  dup  uuid := '25eb5b34-e377-4c98-b90e-83ea3ccaebb8';
  ep35 uuid := 'f990d205-67ea-4322-a6fc-609a99727af2';
  r record;
  left_over bigint;
begin
  -- 0. guard: the three rows are still exactly what we diagnosed
  if (select count(*) from episodes
      where (id = ep33 and episode_number = 33) or (id = dup and episode_number = 34) or (id = ep35 and episode_number = 35)) <> 3 then
    raise exception 'episode rows changed since diagnosis, nothing done';
  end if;

  -- 1. docket_topics: append after EP33's existing card, keep their order
  with base as (select coalesce(max(sort_order), -1) as b from docket_topics where episode_id = ep33),
       mv   as (select id, row_number() over (order by sort_order, created_at) as rn from docket_topics where episode_id = dup)
  update docket_topics dt set episode_id = ep33, sort_order = base.b + mv.rn
  from mv, base where dt.id = mv.id;

  -- 2. every other table with a FK to episodes(id)
  for r in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public'
      and ccu.table_name = 'episodes' and ccu.column_name = 'id' and tc.table_name <> 'docket_topics'
  loop
    execute format('update public.%I set %I = $1 where %I = $2', r.table_name, r.column_name, r.column_name) using ep33, dup;
  end loop;

  -- 3. guard: nothing may still point at the duplicate (else the delete would cascade it away)
  for r in
    select tc.table_name, kcu.column_name
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu on ccu.constraint_name = tc.constraint_name and ccu.table_schema = tc.table_schema
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_schema = 'public' and ccu.table_name = 'episodes' and ccu.column_name = 'id'
  loop
    execute format('select count(*) from public.%I where %I = $1', r.table_name, r.column_name) into left_over using dup;
    if left_over > 0 then raise exception '% rows still reference the duplicate in %', left_over, r.table_name; end if;
  end loop;

  -- 4. delete the empty duplicate, then renumber the show's EP34 (unique(show_id, episode_number) needs this order)
  delete from episodes where id = dup;
  update episodes set episode_number = 34, title = 'EP 34' where id = ep35;
end $$;

-- 5. verify before committing: expect 33 -> 19 topics, 34 -> 8 topics, no row 35
select e.episode_number, e.title, e.recording_date, count(t.id) as topics
from episodes e left join docket_topics t on t.episode_id = e.id
where e.episode_number between 32 and 36
group by e.id order by e.episode_number;

commit;   -- or rollback; if step 5 looks wrong
