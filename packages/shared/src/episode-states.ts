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

// Forward transitions from each state. Re-entry (staying in place) is always
// allowed, and re-running an already-completed phase is allowed by letting a
// state transition back to its own "running" precursor (e.g. research_ready →
// research_running). This keeps the pipeline ordered but not brittle, so
// clicking Generate a second time on any page doesn't lock up the UI.
export const VALID_TRANSITIONS: Record<EpisodeStatus, EpisodeStatus[]> = {
  created: ["docket_open"],
  docket_open: ["docket_locked"],
  docket_locked: ["docket_open", "research_running"],
  research_running: ["research_ready"],
  research_ready: ["research_running", "runsheet_ready"],
  runsheet_ready: ["research_running", "recording"],
  recording: ["transcript_received"],
  transcript_received: ["repurpose_running"],
  repurpose_running: ["content_ready"],
  content_ready: ["repurpose_running", "video_processing"],
  video_processing: ["video_ready"],
  video_ready: ["video_processing", "delivered"],
  delivered: ["posted"],
  posted: [],
};

export function canTransition(
  from: EpisodeStatus,
  to: EpisodeStatus
): boolean {
  if (from === to) return true;
  return VALID_TRANSITIONS[from].includes(to);
}
