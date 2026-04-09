-- Add original_url to docket_topics to preserve the source link that was pasted in
alter table docket_topics add column original_url text not null default '';
