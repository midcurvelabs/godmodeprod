import type { EpisodeStatus } from "./episode-states";

// --- Core ---

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface Show {
  id: string;
  org_id: string;
  name: string;
  slug: string;
  brand_color: string;
  logo_url: string | null;
  theme_music_url: string | null;
  created_at: string;
}

export type ContextType = "soul" | "hosts" | "brand" | "workflow";

export interface ShowContext {
  id: string;
  show_id: string;
  context_type: ContextType;
  content: Record<string, unknown>;
  updated_at: string;
}

export interface Host {
  id: string;
  show_id: string;
  name: string;
  role: string;
  platforms: Record<string, string>;
  voice_characteristics: string;
  clip_style: string;
  photo_url: string | null;
  sort_order: number;
}

export interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  email: string;
  avatar_url: string | null;
}

export type OrgRole = "owner" | "admin" | "member";

export interface OrgMember {
  id: string;
  org_id: string;
  profile_id: string;
  role: OrgRole;
  created_at: string;
}

// --- Episodes ---

export interface Episode {
  id: string;
  show_id: string;
  episode_number: number;
  title: string;
  subtitle: string | null;
  status: EpisodeStatus;
  recording_date: string | null;
  created_at: string;
  updated_at: string;
}

// --- Pre-Production ---

export type DocketTopicStatus = "under_review" | "in" | "out";

export interface DocketTopic {
  id: string;
  episode_id: string;
  show_id: string;
  title: string;
  context: string;
  angle: string;
  sources: Array<{ url: string; title: string }>;
  submitted_by: string;
  status: DocketTopicStatus;
  sort_order: number;
  created_at: string;
}

export type VoteDirection = "up" | "down";

export interface DocketVote {
  id: string;
  topic_id: string;
  host_id: string;
  vote: VoteDirection;
  created_at: string;
}

export interface DocketComment {
  id: string;
  topic_id: string;
  author_id: string;
  content: string;
  created_at: string;
}

export interface ResearchBrief {
  id: string;
  episode_id: string;
  content: Record<string, unknown>;
  status: string;
  generated_at: string;
}

export interface Runsheet {
  id: string;
  episode_id: string;
  content: Record<string, unknown>;
  status: string;
  generated_at: string;
}

export interface Hooks {
  id: string;
  episode_id: string;
  youtube_titles: string[];
  youtube_desc: string;
  podcast_desc: string;
  email_subject: string;
  opening_tweet: string;
  generated_at: string;
}

// --- Post-Production ---

export interface Transcript {
  id: string;
  episode_id: string;
  raw_content: string;
  clean_content: string | null;
  speaker_tags: Record<string, unknown> | null;
  word_count: number;
  status: string;
  uploaded_at: string;
}

export type RepurposeOutputType =
  | "master"
  | "captions"
  | "twitter"
  | "linkedin"
  | "youtube_segments"
  | "schedule"
  | "clip_timestamps";

export interface RepurposeOutput {
  id: string;
  episode_id: string;
  output_type: RepurposeOutputType;
  content: Record<string, unknown>;
  host_id: string | null;
  status: string;
  generated_at: string;
}

export interface Newsletter {
  id: string;
  episode_id: string;
  main_content: string;
  notes_content: string;
  subject_options: string[];
  status: string;
  generated_at: string;
}

// --- Video ---

export type SourceVideoStatus = "uploading" | "ready" | "processing";

export interface SourceVideo {
  id: string;
  episode_id: string;
  file_url: string;
  file_size: number;
  duration_seconds: number | null;
  status: SourceVideoStatus;
  uploaded_at: string;
}

export type ClipStatus =
  | "queued"
  | "cutting"
  | "transcribing"
  | "captioning"
  | "compositing"
  | "done"
  | "error"
  | "skipped";

export interface Clip {
  id: string;
  episode_id: string;
  source_video_id: string;
  name: string;
  host_id: string;
  start_time: number;
  end_time: number;
  hook: string;
  caption_text: string | null;
  caption_ass_url: string | null;
  output_url: string | null;
  thumbnail_url: string | null;
  status: ClipStatus;
  error_message: string | null;
  created_at: string;
}

export type MashupVariant =
  | "standard"
  | "reversed"
  | "theme_lead"
  | "flash"
  | "gaps";

export interface MashupOutput {
  id: string;
  episode_id: string;
  variant: MashupVariant;
  output_url: string | null;
  status: string;
  created_at: string;
}

export interface ThumbnailOutput {
  id: string;
  episode_id: string;
  subtitle: string;
  output_url: string | null;
  status: string;
  created_at: string;
}

// --- System ---

export interface ActivityLog {
  id: string;
  show_id: string;
  episode_id: string | null;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
}

export type JobStatus = "pending" | "running" | "completed" | "failed";

export interface Job {
  id: string;
  show_id: string;
  episode_id: string | null;
  queue: string;
  job_type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// --- Skill Context (dynamic injection) ---

export interface SkillContext {
  show_slug: string;
  soul: Record<string, unknown>;
  hosts: Record<string, unknown>;
  brand: Record<string, unknown>;
  workflow: Record<string, unknown>;
  assets_path: string;
  episode_number: number;
  episode_id: string;
}
