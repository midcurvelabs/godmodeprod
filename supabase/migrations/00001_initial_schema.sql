-- GodModeProd Initial Schema
-- 19 tables for the AI Podcast OS

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================
-- CORE TABLES
-- ============================================

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table shows (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  slug text not null unique,
  brand_color text not null default '#E8001D',
  logo_url text,
  theme_music_url text,
  created_at timestamptz not null default now()
);

create index idx_shows_org on shows(org_id);

create type context_type as enum ('soul', 'hosts', 'brand', 'workflow');

create table show_context (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  context_type context_type not null,
  content jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(show_id, context_type)
);

create table hosts (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  name text not null,
  role text not null default '',
  platforms jsonb not null default '{}',
  voice_characteristics text not null default '',
  clip_style text not null default '',
  photo_url text,
  sort_order int not null default 0
);

create index idx_hosts_show on hosts(show_id);

create table profiles (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null unique,
  display_name text not null,
  email text not null,
  avatar_url text
);

create type org_role as enum ('owner', 'admin', 'member');

create table org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  role org_role not null default 'member',
  created_at timestamptz not null default now(),
  unique(org_id, profile_id)
);

-- ============================================
-- EPISODES
-- ============================================

create type episode_status as enum (
  'created', 'docket_open', 'docket_locked',
  'research_running', 'research_ready', 'runsheet_ready',
  'recording', 'transcript_received', 'repurpose_running',
  'content_ready', 'video_processing', 'video_ready',
  'delivered', 'posted'
);

create table episodes (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  episode_number int not null,
  title text not null,
  subtitle text,
  status episode_status not null default 'created',
  recording_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(show_id, episode_number)
);

create index idx_episodes_show on episodes(show_id);

-- ============================================
-- PRE-PRODUCTION
-- ============================================

create type docket_topic_status as enum ('under_review', 'in', 'out');

create table docket_topics (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  show_id uuid not null references shows(id) on delete cascade,
  title text not null,
  context text not null default '',
  angle text not null default '',
  sources jsonb not null default '[]',
  submitted_by text not null default '',
  status docket_topic_status not null default 'under_review',
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index idx_docket_topics_episode on docket_topics(episode_id);

create type vote_direction as enum ('up', 'down');

create table docket_votes (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references docket_topics(id) on delete cascade,
  host_id uuid not null references hosts(id) on delete cascade,
  vote vote_direction not null,
  created_at timestamptz not null default now(),
  unique(topic_id, host_id)
);

create table docket_comments (
  id uuid primary key default uuid_generate_v4(),
  topic_id uuid not null references docket_topics(id) on delete cascade,
  author_id uuid not null,
  content text not null,
  created_at timestamptz not null default now()
);

create table research_briefs (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  content jsonb not null default '{}',
  status text not null default 'pending',
  generated_at timestamptz
);

create table runsheets (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  content jsonb not null default '{}',
  status text not null default 'pending',
  generated_at timestamptz
);

create table hooks (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  youtube_titles jsonb not null default '[]',
  youtube_desc text not null default '',
  podcast_desc text not null default '',
  email_subject text not null default '',
  opening_tweet text not null default '',
  generated_at timestamptz
);

-- ============================================
-- POST-PRODUCTION
-- ============================================

create table transcripts (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  raw_content text not null,
  clean_content text,
  speaker_tags jsonb,
  word_count int not null default 0,
  status text not null default 'uploaded',
  uploaded_at timestamptz not null default now()
);

create type repurpose_output_type as enum (
  'master', 'captions', 'twitter', 'linkedin',
  'youtube_segments', 'schedule', 'clip_timestamps'
);

create table repurpose_outputs (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  output_type repurpose_output_type not null,
  content jsonb not null default '{}',
  host_id uuid references hosts(id),
  status text not null default 'pending',
  generated_at timestamptz
);

create index idx_repurpose_episode on repurpose_outputs(episode_id);

create table newsletters (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  main_content text not null default '',
  notes_content text not null default '',
  subject_options jsonb not null default '[]',
  status text not null default 'pending',
  generated_at timestamptz
);

-- ============================================
-- VIDEO
-- ============================================

create type source_video_status as enum ('uploading', 'ready', 'processing');

create table source_videos (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  file_url text not null,
  file_size bigint not null default 0,
  duration_seconds numeric,
  status source_video_status not null default 'uploading',
  uploaded_at timestamptz not null default now()
);

create type clip_status as enum (
  'queued', 'cutting', 'transcribing', 'captioning',
  'compositing', 'done', 'error', 'skipped'
);

create table clips (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  source_video_id uuid references source_videos(id),
  name text not null,
  host_id uuid references hosts(id),
  start_time numeric not null,
  end_time numeric not null,
  hook text not null default '',
  caption_text text,
  caption_ass_url text,
  output_url text,
  thumbnail_url text,
  status clip_status not null default 'queued',
  error_message text,
  created_at timestamptz not null default now()
);

create index idx_clips_episode on clips(episode_id);

create type mashup_variant as enum ('standard', 'reversed', 'theme_lead', 'flash', 'gaps');

create table mashup_outputs (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  variant mashup_variant not null,
  output_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table thumbnail_outputs (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  subtitle text not null default '',
  output_url text,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ============================================
-- SYSTEM
-- ============================================

create table activity_log (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  episode_id uuid references episodes(id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index idx_activity_show on activity_log(show_id);
create index idx_activity_episode on activity_log(episode_id);
create index idx_activity_created on activity_log(created_at desc);

create type job_status as enum ('pending', 'running', 'completed', 'failed');

create table jobs (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  episode_id uuid references episodes(id) on delete set null,
  queue text not null,
  job_type text not null,
  status job_status not null default 'pending',
  payload jsonb not null default '{}',
  result jsonb,
  error text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_jobs_show on jobs(show_id);
create index idx_jobs_status on jobs(status);

-- ============================================
-- ROW LEVEL SECURITY (basic setup)
-- ============================================

alter table organizations enable row level security;
alter table shows enable row level security;
alter table episodes enable row level security;
alter table docket_topics enable row level security;
alter table profiles enable row level security;

-- Public read for docket voting (no auth required)
create policy "Public can read docket topics for voting"
  on docket_topics for select
  using (true);

-- Profiles: users can read/update their own
create policy "Users can read own profile"
  on profiles for select
  using (auth.uid() = user_id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = user_id);
