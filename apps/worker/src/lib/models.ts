// --- Model routing table ---
//
// Single source of truth for which LLM each skill uses. Change this file to
// swap models — skill code doesn't care.
//
// Providers:
//  - "openrouter"  → lib/openrouter.ts (all Claude + Grok traffic, one key)
//  - "google"      → lib/gemini.ts (long-context Gemini + image gen)
//
// Skill names map 1:1 to files in skills/ EXCEPT for "repurpose-write", which
// has 4 internal sub-calls — those get their own routing keys:
//   repurpose-shorts, repurpose-twitter, repurpose-linkedin, repurpose-youtube
//
// Model IDs below are OpenRouter slugs. If a slug is wrong for a given model,
// set the env override (see MODEL_ID_OVERRIDES at bottom) without code changes.

export type Provider = "openrouter" | "google";

export interface ModelConfig {
  via: Provider;
  model: string;
  maxTokens?: number;
  // Claude extended thinking via OpenRouter: passed as `reasoning: { effort }`
  extendedThinking?: "low" | "medium" | "high";
  // Force JSON response. Sent as `response_format: { type: "json_object" }`.
  // Eliminates markdown-fence wrapping and guarantees valid JSON output.
  jsonObject?: boolean;
}

export type SkillKey =
  // --- Prep phase ---
  | "docket-add"
  | "docket-summarise"
  | "guest-enrich"
  | "research-brief-facts"
  | "research-brief-synth"
  | "research-brief" // fallback single-stage (used when feature flag off)
  | "tight-questions"
  | "hook-writing"
  | "runsheet"
  | "slide-generation"
  // --- Transcript / analysis ---
  | "transcript-ingest"
  | "repurpose-analyze"
  // --- Repurpose sub-skills (split out from repurpose-write) ---
  | "repurpose-shorts"
  | "repurpose-twitter"
  | "repurpose-linkedin"
  | "repurpose-youtube"
  // --- Newsletter + quality gate ---
  | "substack"
  | "humanizer";

// Model slug constants — keep in one place so we can bump versions easily.
// NOTE: OpenRouter model slugs evolve. If any of these 404 at runtime, set an
// env override like `MODEL_OVERRIDE_slide_generation=anthropic/claude-sonnet-4.5`.
const SONNET = "anthropic/claude-sonnet-4.6";
const HAIKU = "anthropic/claude-haiku-4.5";
const GROK_FAST = "x-ai/grok-4-fast";

export const MODEL_ROUTING: Record<SkillKey, ModelConfig> = {
  // === Prep phase ===
  "docket-add": { via: "openrouter", model: GROK_FAST, maxTokens: 2048 },
  "docket-summarise": { via: "openrouter", model: HAIKU, maxTokens: 2048 },
  "guest-enrich": { via: "openrouter", model: GROK_FAST, maxTokens: 2048 },

  // research-brief is split into 2 stages (Grok facts → Sonnet synth).
  // The single-stage "research-brief" key is kept as a fallback.
  // Synth at 64K because 20+ topics × 9 fields each can easily blow past 32K
  // output tokens; Sonnet 4.6 supports up to 128K.
  "research-brief-facts": { via: "openrouter", model: GROK_FAST, maxTokens: 8192, jsonObject: true },
  "research-brief-synth": { via: "openrouter", model: SONNET, maxTokens: 64000, jsonObject: true },
  "research-brief": { via: "openrouter", model: SONNET, maxTokens: 64000, jsonObject: true },

  "tight-questions": { via: "openrouter", model: HAIKU, maxTokens: 4096 },
  "hook-writing": { via: "openrouter", model: HAIKU, maxTokens: 2048 },
  "runsheet": { via: "openrouter", model: SONNET, maxTokens: 8192 },

  // Slide generation — user's explicit pain point.
  // Sonnet 4.6 + extended thinking + bumped token budget.
  "slide-generation": {
    via: "openrouter",
    model: SONNET,
    maxTokens: 8192,
    extendedThinking: "high",
  },

  // === Transcript / analysis (Google direct) ===
  "transcript-ingest": { via: "google", model: "gemini-2.5-flash" },
  "repurpose-analyze": { via: "google", model: "gemini-2.5-pro" },

  // === Repurpose sub-skills ===
  "repurpose-shorts": { via: "openrouter", model: HAIKU, maxTokens: 8192 },
  "repurpose-twitter": { via: "openrouter", model: GROK_FAST, maxTokens: 8192 },
  "repurpose-linkedin": { via: "openrouter", model: SONNET, maxTokens: 6144 },
  "repurpose-youtube": { via: "openrouter", model: HAIKU, maxTokens: 8192 },

  // === Newsletter + quality gate ===
  "substack": { via: "openrouter", model: SONNET, maxTokens: 8192 },
  "humanizer": { via: "openrouter", model: SONNET, maxTokens: 8192 },
};

// --- Env overrides ---
// Any skill's model can be overridden at runtime without code changes.
// Env var format: MODEL_OVERRIDE_<skill_key_with_underscores>
// e.g. MODEL_OVERRIDE_slide_generation=anthropic/claude-opus-4.6
export function resolveModel(skill: SkillKey): ModelConfig {
  const base = MODEL_ROUTING[skill];
  const envKey = `MODEL_OVERRIDE_${skill.replace(/-/g, "_")}`;
  const override = process.env[envKey];
  if (override) {
    return { ...base, model: override };
  }
  return base;
}
