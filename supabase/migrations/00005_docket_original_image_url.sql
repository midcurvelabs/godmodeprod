-- Add original_image_url to docket_topics for OG image / tweet media thumbnail display
alter table docket_topics add column original_image_url text;
