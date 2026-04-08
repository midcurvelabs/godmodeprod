-- Episode Slides table for presentation cards generated from research + docket
create table episode_slides (
  id uuid primary key default uuid_generate_v4(),
  episode_id uuid not null references episodes(id) on delete cascade,
  content jsonb not null default '{}',
  style jsonb not null default '{}',
  status text not null default 'pending',
  generated_at timestamptz
);

create index idx_episode_slides_episode on episode_slides(episode_id);
