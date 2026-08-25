-- Fix Supabase advisor: rls_disabled_in_public
-- Enable RLS on every public table that was missing it.
--
-- Safe for this app: web server + worker use SUPABASE_SERVICE_ROLE_KEY,
-- which bypasses RLS. Anon/authenticated clients get deny-by-default
-- unless a policy exists (docket_topics + guests already have public SELECT).

alter table show_context enable row level security;
alter table hosts enable row level security;
alter table org_members enable row level security;
alter table docket_votes enable row level security;
alter table docket_comments enable row level security;
alter table research_briefs enable row level security;
alter table runsheets enable row level security;
alter table hooks enable row level security;
alter table transcripts enable row level security;
alter table repurpose_outputs enable row level security;
alter table newsletters enable row level security;
alter table source_videos enable row level security;
alter table clips enable row level security;
alter table mashup_outputs enable row level security;
alter table thumbnail_outputs enable row level security;
alter table activity_log enable row level security;
alter table jobs enable row level security;
alter table episode_slides enable row level security;
