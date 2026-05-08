-- One-shot data fix: the auto-rollover in ensureLatestEpisode silently
-- created EP 13 once EP 12's recording_date passed, and a few captures
-- landed there before we noticed. This script moves all EP 13 child rows
-- back to EP 12, then deletes the empty EP 13 episode row so the dropdown
-- and Telegram bot stop offering it.
--
-- Idempotent: once EP 13 is gone, every `where episode_id = (select … 13)`
-- clause matches nothing, so re-running this migration is a no-op.

-- docket_topics: keep sort_order continuous after existing EP 12 entries.
with ep as (
  select
    (select id from episodes where episode_number = 12) as ep12,
    (select id from episodes where episode_number = 13) as ep13
),
max_order as (
  select coalesce(max(sort_order), -1) as base
  from docket_topics
  where episode_id = (select ep12 from ep)
),
to_move as (
  select id, row_number() over (order by sort_order, created_at) as rn
  from docket_topics
  where episode_id = (select ep13 from ep)
)
update docket_topics dt
set episode_id = (select ep12 from ep),
    sort_order = (select base from max_order) + tm.rn
from to_move tm
where dt.id = tm.id;

-- Repoint every other episode-scoped table.
update research_briefs    set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update runsheets          set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update hooks              set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update episode_slides     set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update transcripts        set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update repurpose_outputs  set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update newsletters        set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update source_videos      set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update clips              set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update mashup_outputs     set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update thumbnail_outputs  set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update activity_log       set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);
update jobs               set episode_id = (select id from episodes where episode_number = 12) where episode_id = (select id from episodes where episode_number = 13);

-- Free EP 13 (delete the empty episode row).
delete from episodes where episode_number = 13;
