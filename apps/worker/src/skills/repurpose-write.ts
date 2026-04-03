import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";
import type { SkillContext } from "@godmodeprod/shared";

interface RepurposeWritePayload {
  episodeId: string;
  showId: string;
  outputType?: string; // If set, only regenerate this specific output type
}

// --- Shared helpers ---

async function fetchPrerequisites(payload: RepurposeWritePayload) {
  const { data: masterOutput } = await supabase
    .from("repurpose_outputs")
    .select("*")
    .eq("episode_id", payload.episodeId)
    .eq("output_type", "master")
    .order("generated_at", { ascending: false })
    .limit(1)
    .single();

  if (!masterOutput) {
    throw new Error("No master analysis found. Run repurpose-analyze first.");
  }

  const { data: hosts } = await supabase
    .from("hosts")
    .select("id, name, role, voice_characteristics, clip_style, platforms")
    .eq("show_id", payload.showId)
    .order("sort_order", { ascending: true });

  const { data: showContextRows } = await supabase
    .from("show_context")
    .select("context_type, content")
    .eq("show_id", payload.showId);

  const context: SkillContext = {
    show_slug: "",
    soul: {} as Record<string, unknown>,
    hosts: {} as Record<string, unknown>,
    brand: {} as Record<string, unknown>,
    workflow: {} as Record<string, unknown>,
    assets_path: "",
    episode_number: 0,
    episode_id: payload.episodeId,
  };

  if (showContextRows) {
    for (const row of showContextRows) {
      const ct = row.context_type as string;
      if (ct === "soul") context.soul = row.content as Record<string, unknown>;
      else if (ct === "hosts") context.hosts = row.content as Record<string, unknown>;
      else if (ct === "brand") context.brand = row.content as Record<string, unknown>;
      else if (ct === "workflow") context.workflow = row.content as Record<string, unknown>;
    }
  }

  const hostList = (hosts || [])
    .map((h) => `- ${h.name} (${h.role || "host"}): voice="${h.voice_characteristics || "natural conversational tone"}", clip_style="${h.clip_style || "default"}", platforms=${JSON.stringify(h.platforms || "all")}`)
    .join("\n");

  return { masterOutput, hosts: hosts || [], hostList, context };
}

async function saveOutput(
  episodeId: string,
  outputType: string,
  content: Record<string, unknown>,
  hostId?: string
): Promise<string | null> {
  const { data } = await supabase
    .from("repurpose_outputs")
    .insert({
      episode_id: episodeId,
      output_type: outputType,
      content,
      host_id: hostId || null,
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  return data?.id || null;
}

// --- Call 1: Shorts Captions ---

const CAPTIONS_PROMPT = `You are a short-form video caption writer for podcasts. Write platform-native captions for podcast clips.

## Rules (STRICT)
- Line 1 = HOOK. Bold claim, question, or pattern interrupt. MAX 8 WORDS.
- NEVER start with "In this clip", "In this video", "Don't forget to", "So basically"
- Max 2 emojis per caption
- Tag companies/people mentioned (e.g., @OpenAI, @AnthropicAI)
- Each clip gets 3 caption variants (one per platform)

## Platform Formatting
- TikTok: Punchy, lowercase-friendly, 3-5 hashtags, conversational
- Instagram Reels: Slightly more room, 5-10 hashtags, can be a bit longer
- YouTube Shorts: Include show name, 3-5 hashtags, slightly more formal

## Per-Host Voice
Match each host's voice_characteristics exactly. The caption should sound like THEY would write it.

Output ONLY valid JSON:
{
  "per_host": {
    "HOST_NAME": [
      {
        "clip_ref": "Reference to the clip from analysis (title or index)",
        "hook": "The 8-word hook",
        "tiktok": "Full TikTok caption with hashtags",
        "instagram": "Full Instagram Reels caption with hashtags",
        "youtube_shorts": "Full YouTube Shorts caption with hashtags",
        "companies_tagged": ["@CompanyName"]
      }
    ]
  }
}`;

async function writeCaptions(
  payload: RepurposeWritePayload,
  callClaude: typeof ClaudeFn,
  masterContent: Record<string, unknown>,
  hostList: string,
  context: SkillContext,
  hosts: Array<{ id: string; name: string }>
): Promise<string[]> {
  const userPrompt = `Hosts:\n${hostList}\n\nClip candidates from analysis:\n${JSON.stringify(masterContent.clip_candidates, null, 2)}\n\nWrite shorts captions for every clip candidate. Each host must have captions for all their clips.`;

  const response = await callClaude({
    systemPrompt: CAPTIONS_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
  });

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { raw: response };
  }

  const ids: string[] = [];
  const perHost = (parsed.per_host || parsed) as Record<string, unknown>;

  for (const host of hosts) {
    const hostCaptions = perHost[host.name];
    if (!hostCaptions) continue;
    const id = await saveOutput(payload.episodeId, "captions", { clips: hostCaptions } as Record<string, unknown>, host.id);
    if (id) ids.push(id);
  }

  return ids;
}

// --- Call 2: Twitter ---

const TWITTER_PROMPT = `You are a Twitter/X content strategist for podcasts. Write viral tweets and threads from podcast episodes.

## Tweet Rules (STRICT)
- NEVER start a tweet with "I" (algorithm penalty)
- NEVER end with "thoughts?" or "what do you think?"
- No hashtags in tweet body (only thread final tweet)
- Short sentences. Line breaks for emphasis. Max 280 chars per tweet.

## Requirements
PER HOST, generate:
1. A THREAD of 10-14 tweets covering the episode from that host's perspective
   - Tweet 1 = hook (bold claim or surprising stat)
   - Tweets 2-12 = substance (insights, examples, data)
   - Final tweet = soft CTA (watch/listen link placeholder)
2. STANDALONE TWEETS (minimum 10 total across hosts):
   - 4x text-only (strong opinion or stat, no clip reference)
   - 6x clip-paired (reference a specific clip moment, include [CLIP: clip_ref] tag)
   - Distribute across hosts

## Per-Host Voice
Match each host's voice and expertise. A marketer tweets differently than an analyst.

Output ONLY valid JSON:
{
  "per_host": {
    "HOST_NAME": {
      "thread": ["Tweet 1 (hook)", "Tweet 2", "...", "Tweet N (CTA)"],
      "standalone_tweets": [
        { "text": "Tweet text", "type": "text_only | clip_paired", "clip_ref": "optional clip reference" }
      ]
    }
  }
}`;

async function writeTwitter(
  payload: RepurposeWritePayload,
  callClaude: typeof ClaudeFn,
  masterContent: Record<string, unknown>,
  hostList: string,
  context: SkillContext,
  hosts: Array<{ id: string; name: string }>
): Promise<string[]> {
  const userPrompt = `Hosts:\n${hostList}\n\nEpisode analysis:\n${JSON.stringify({
    episode_summary: masterContent.episode_summary,
    key_moments: masterContent.key_moments,
    clip_candidates: masterContent.clip_candidates,
    quotable_lines: masterContent.quotable_lines,
    themes: masterContent.themes,
  }, null, 2)}\n\nWrite Twitter threads and standalone tweets for each host. Minimum 10 standalone tweets total.`;

  const response = await callClaude({
    systemPrompt: TWITTER_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
  });

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { raw: response };
  }

  const ids: string[] = [];
  const perHost = (parsed.per_host || parsed) as Record<string, unknown>;

  for (const host of hosts) {
    const hostTwitter = perHost[host.name];
    if (!hostTwitter) continue;
    const id = await saveOutput(payload.episodeId, "twitter", hostTwitter as Record<string, unknown>, host.id);
    if (id) ids.push(id);
  }

  return ids;
}

// --- Call 3: LinkedIn ---

const LINKEDIN_PROMPT = `You are a LinkedIn content strategist for podcast hosts. Write LinkedIn posts that feel native to the platform.

## LinkedIn Rules (STRICT)
- PROSE ONLY. No bullet points in the body. No numbered lists.
- 300-400 words per post
- Soft CTA at the end (never "like and subscribe")
- No hype words: "groundbreaking", "game-changing", "revolutionary", "stunning"
- No em-dashes (use commas or periods)
- Write like a thoughtful professional sharing insights, not a press release

## Angle Types (generate 3 posts total, distributed across hosts)
1. Builder/solopreneur angle (best for hosts who build products)
2. Product/business angle (best for analytical hosts)
3. Tech/industry angle (rotate across hosts)

## Per-Host Voice
LinkedIn posts should match each host's professional voice. An indie hacker writes differently than a macro thinker.

Output ONLY valid JSON:
{
  "per_host": {
    "HOST_NAME": {
      "post": "Full LinkedIn post with line breaks. 300-400 words. Prose only.",
      "angle": "builder | product | tech",
      "char_count": 1850
    }
  }
}`;

async function writeLinkedIn(
  payload: RepurposeWritePayload,
  callClaude: typeof ClaudeFn,
  masterContent: Record<string, unknown>,
  hostList: string,
  context: SkillContext,
  hosts: Array<{ id: string; name: string }>
): Promise<string[]> {
  const userPrompt = `Hosts:\n${hostList}\n\nEpisode analysis:\n${JSON.stringify({
    episode_summary: masterContent.episode_summary,
    themes: masterContent.themes,
    quotable_lines: masterContent.quotable_lines,
    content_angles: masterContent.content_angles,
  }, null, 2)}\n\nWrite 3 LinkedIn posts (one per host or distributed). Each post 300-400 words, prose only, no bullets.`;

  const response = await callClaude({
    systemPrompt: LINKEDIN_PROMPT,
    userPrompt,
    context,
    maxTokens: 6144,
  });

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { raw: response };
  }

  const ids: string[] = [];
  const perHost = (parsed.per_host || parsed) as Record<string, unknown>;

  for (const host of hosts) {
    const hostLinkedIn = perHost[host.name];
    if (!hostLinkedIn) continue;
    const id = await saveOutput(payload.episodeId, "linkedin", hostLinkedIn as Record<string, unknown>, host.id);
    if (id) ids.push(id);
  }

  return ids;
}

// --- Call 4: YouTube + Schedule + Clip Timestamps ---

const YOUTUBE_SCHEDULE_PROMPT = `You are a YouTube strategist and content scheduler for podcasts.

## YouTube Segments (3-4 long-form segments, 5-15 min each)
- These are contextual cuts from the full episode, NOT the same as shorts clips
- Each segment needs 3 genuinely different title options (not just word swaps)
- Include thumbnail direction (which host, expression, text overlay suggestion)
- Paste-ready description (150-250 words)
- Chapter timestamps within the segment

## Posting Schedule (7-day plan)
Respect these platform limits:
- TikTok + Reels: max 2 clips/day per account, spaced 3-4 hours apart
- YouTube Shorts: 1-2/day per channel
- Twitter: no hard limit but space out
- LinkedIn: max 1 post/day, skip weekends
- Priority 1 clips go days 1-3, Priority 2 days 3-5, Priority 3 weekends

## Clip Timestamps
Extract precise timestamps for the video pipeline. These feed into automated clip cutting.

Output ONLY valid JSON:
{
  "youtube_segments": [
    {
      "title_options": ["Title A", "Title B", "Title C"],
      "description": "Paste-ready YouTube description (150-250 words)",
      "start_ref": "Approximate start in transcript",
      "end_ref": "Approximate end in transcript",
      "estimated_duration_minutes": 8,
      "chapters": [
        { "timestamp": "0:00", "title": "Chapter title" }
      ],
      "thumbnail_direction": {
        "host": "Host name for thumbnail",
        "expression": "surprised | laughing | serious | pointing",
        "text_overlay": "Suggested text for thumbnail"
      }
    }
  ],
  "schedule": {
    "day_1": [
      { "platform": "tiktok", "content_type": "clip", "clip_ref": "Clip title or ref", "host": "Host", "time": "10:00" }
    ],
    "day_2": [],
    "day_3": [],
    "day_4": [],
    "day_5": [],
    "day_6": [],
    "day_7": []
  },
  "clip_timestamps": [
    {
      "title": "Clip title",
      "host": "Host name",
      "start_ref": "Approximate start",
      "end_ref": "Approximate end",
      "hook": "Clip hook text",
      "priority": 1,
      "platforms": ["tiktok", "instagram", "youtube_shorts"]
    }
  ]
}`;

async function writeYouTubeScheduleClips(
  payload: RepurposeWritePayload,
  callClaude: typeof ClaudeFn,
  masterContent: Record<string, unknown>,
  hostList: string,
  context: SkillContext
): Promise<string[]> {
  const userPrompt = `Hosts:\n${hostList}\n\nEpisode analysis:\n${JSON.stringify({
    episode_summary: masterContent.episode_summary,
    clip_candidates: masterContent.clip_candidates,
    topic_segments: masterContent.topic_segments,
    themes: masterContent.themes,
    host_clip_summary: masterContent.host_clip_summary,
  }, null, 2)}\n\nGenerate YouTube segments, a 7-day posting schedule, and clip timestamps for the video pipeline.`;

  const response = await callClaude({
    systemPrompt: YOUTUBE_SCHEDULE_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
  });

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { raw: response };
  }

  const ids: string[] = [];

  if (parsed.youtube_segments) {
    const segContent = Array.isArray(parsed.youtube_segments)
      ? { segments: parsed.youtube_segments }
      : parsed.youtube_segments as Record<string, unknown>;
    const id = await saveOutput(payload.episodeId, "youtube_segments", segContent);
    if (id) ids.push(id);
  }

  if (parsed.schedule) {
    const schedContent = typeof parsed.schedule === "object" && !Array.isArray(parsed.schedule)
      ? parsed.schedule as Record<string, unknown>
      : { days: parsed.schedule };
    const id = await saveOutput(payload.episodeId, "schedule", schedContent);
    if (id) ids.push(id);
  }

  if (parsed.clip_timestamps) {
    const clipContent = Array.isArray(parsed.clip_timestamps)
      ? { clips: parsed.clip_timestamps }
      : parsed.clip_timestamps as Record<string, unknown>;
    const id = await saveOutput(payload.episodeId, "clip_timestamps", clipContent);
    if (id) ids.push(id);
  }

  return ids;
}

// --- Main Execute ---

export async function execute(
  payload: RepurposeWritePayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  const { masterOutput, hosts, hostList, context } = await fetchPrerequisites(payload);
  const masterContent = masterOutput.content as Record<string, unknown>;
  const allIds: string[] = [];

  // Determine which outputs to generate
  const targetType = payload.outputType;

  if (!targetType || targetType === "captions") {
    const ids = await writeCaptions(payload, callClaude, masterContent, hostList, context, hosts);
    allIds.push(...ids);
  }

  if (!targetType || targetType === "twitter") {
    const ids = await writeTwitter(payload, callClaude, masterContent, hostList, context, hosts);
    allIds.push(...ids);
  }

  if (!targetType || targetType === "linkedin") {
    const ids = await writeLinkedIn(payload, callClaude, masterContent, hostList, context, hosts);
    allIds.push(...ids);
  }

  if (!targetType || targetType === "youtube_segments" || targetType === "schedule" || targetType === "clip_timestamps") {
    const ids = await writeYouTubeScheduleClips(payload, callClaude, masterContent, hostList, context);
    allIds.push(...ids);
  }

  // Advance episode status only on full run
  if (!targetType) {
    await supabase
      .from("episodes")
      .update({ status: "content_ready", updated_at: new Date().toISOString() })
      .eq("id", payload.episodeId);
  }

  return { outputCount: allIds.length, outputIds: allIds };
}
