export const EPISODE_STATES = [
  "created",
  "docket_open",
  "docket_locked",
  "research_running",
  "research_ready",
  "runsheet_ready",
  "recording",
  "transcript_received",
  "repurpose_running",
  "content_ready",
  "video_processing",
  "video_ready",
  "delivered",
  "posted",
] as const;

export type EpisodeStatus = (typeof EPISODE_STATES)[number];

export const VALID_TRANSITIONS: Record<EpisodeStatus, EpisodeStatus[]> = {
  created: ["docket_open"],
  docket_open: ["docket_locked"],
  docket_locked: ["research_running"],
  research_running: ["research_ready"],
  research_ready: ["runsheet_ready"],
  runsheet_ready: ["recording"],
  recording: ["transcript_received"],
  transcript_received: ["repurpose_running"],
  repurpose_running: ["content_ready"],
  content_ready: ["video_processing"],
  video_processing: ["video_ready"],
  video_ready: ["delivered"],
  delivered: ["posted"],
  posted: [],
};

export function canTransition(
  from: EpisodeStatus,
  to: EpisodeStatus
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
