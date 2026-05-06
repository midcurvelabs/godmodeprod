export const SKILL_REGISTRY = {
  "docket-add": {
    queue: "ai-jobs" as const,
    model: "gemini" as const,
    description: "Auto-expand a link or topic into a full docket entry",
  },
  "docket-summarise": {
    queue: "ai-jobs" as const,
    model: "gemini" as const,
    description: "Summarize current docket for review",
  },
  "guest-enrich": {
    queue: "ai-jobs" as const,
    model: "gemini" as const,
    description: "Enrich a guest entry with bio + background",
  },
  "research-brief": {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Generate per-topic research brief with depth",
  },
  "tight-questions": {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Generate 4-5 tight questions per topic",
  },
  runsheet: {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Generate timestamped episode runsheet",
  },
  "hook-writing": {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Generate platform-specific hooks and titles",
  },
  "slide-generation": {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Generate episode presentation slides from research + docket",
  },
  "transcript-ingest": {
    queue: "ai-jobs" as const,
    model: "gemini" as const,
    description: "Normalize transcript and tag speakers",
  },
  "repurpose-analyze": {
    queue: "ai-jobs" as const,
    model: "gemini" as const,
    description:
      "Analyze transcript: tag moments, identify clips, extract themes",
  },
  "repurpose-write": {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description:
      "Write all content from analysis: captions, tweets, LinkedIn, etc.",
  },
  substack: {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Generate Substack newsletter from transcript",
  },
  humanizer: {
    queue: "ai-jobs" as const,
    model: "claude" as const,
    description: "Remove AI writing patterns from content",
  },
  "pod-clipper": {
    queue: "video-jobs" as const,
    model: null,
    description: "Cut, caption, and composite 9:16 reels",
  },
  "auto-caption": {
    queue: "media-jobs" as const,
    model: null,
    description: "Deepgram transcription + ASS caption rendering",
  },
  "mashup-maker": {
    queue: "video-jobs" as const,
    model: null,
    description: "Generate 5 mashup reel variants",
  },
  "thumbnail-generator": {
    queue: "media-jobs" as const,
    model: "gemini" as const,
    description: "rembg + Gemini Nano Banana background + composite",
  },
} as const;

export type SkillName = keyof typeof SKILL_REGISTRY;
export type QueueName =
  | "ai-jobs"
  | "video-jobs"
  | "media-jobs"
  | "delivery-jobs";
export type ModelProvider = "claude" | "gemini" | null;
