-- Guest wishlist: show-level pool of potential podcast guests.
-- Inbound via Telegram (/guest <name | @handle | url>); enriched async by
-- the worker's guest-enrich skill; readable from Claude Desktop via MCP.

create type guest_status as enum (
  'wishlist',
  'contacted',
  'confirmed',
  'recorded',
  'declined'
);

create table guests (
  id uuid primary key default uuid_generate_v4(),
  show_id uuid not null references shows(id) on delete cascade,
  name text not null,
  twitter_handle text not null default '',
  twitter_url text not null default '',
  source_url text not null default '',
  bio text not null default '',
  background text not null default '',
  notes text not null default '',
  status guest_status not null default 'wishlist',
  submitted_by text not null default '',
  original_image_url text not null default '',
  enrichment_data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_guests_show on guests(show_id);
create index idx_guests_status on guests(status);
create unique index idx_guests_show_handle
  on guests(show_id, lower(twitter_handle))
  where twitter_handle <> '';

alter table guests enable row level security;

create policy "Public can read guests"
  on guests for select
  using (true);
