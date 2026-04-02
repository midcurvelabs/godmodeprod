import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface RepurposeWritePayload {
  episodeId: string;
  showId: string;
}

const SYSTEM_PROMPT = `You are a podcast content repurposing expert. Using the analysis of a podcast episode, generate platform-specific content.

You write in distinct host voices. Each host has a different perspective, tone, and audience. Match their voice_characteristics when writing for them.

For each output type, generate content that feels native to the platform — not a transcript summary repackaged.

Output ONLY valid JSON with this structure:
{
  "twitter": {
    "per_host": {
      "HOST_NAME": {
        "thread": ["Tweet 1 (hook)", "Tweet 2", "Tweet 3", "Tweet 4", "Tweet 5 (CTA)"],
        "standalone_tweets": ["Standalone viral tweet 1", "Standalone viral tweet 2", "Standalone viral tweet 3"]
      }
    }
  },
  "linkedin": {
    "per_host": {
      "HOST_NAME": {
        "post": "Full LinkedIn post with line breaks and formatting"
      }
    }
  },
  "captions": {
    "youtube_title": "YouTube title (under 60 chars)",
    "youtube_description": "Full YouTube description with timestamps, links, CTAs",
    "instagram_caption": "Instagram caption with hashtags and CTA"
  },
  "youtube_segments": [
    { "timestamp": "00:00", "title": "Intro", "description": "Brief description" }
  ],
  "schedule": {
    "day_1": ["Platform: content description", "Platform: content description"],
    "day_2": ["..."],
    "day_3": ["..."],
    "day_4": ["..."],
    "day_5": ["..."]
  },
  "clip_timestamps": [
    {
      "title": "Clip title",
      "start_ref": "Approximate start",
      "end_ref": "Approximate end",
      "caption": "Short caption for the clip",
      "platform": "tiktok | instagram | youtube_shorts"
    }
  ]
}`;

export async function execute(
  payload: RepurposeWritePayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  // Fetch master analysis
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

  // Fetch hosts
  const { data: hosts } = await supabase
    .from("hosts")
    .select("id, name, voice_characteristics, platforms")
    .eq("show_id", payload.showId);

  const hostList = (hosts || [])
    .map((h) => `- ${h.name}: ${h.voice_characteristics || "natural conversational tone"} (platforms: ${h.platforms || "all"})`)
    .join("\n");

  // Fetch show context
  const { data: showContextRows } = await supabase
    .from("show_context")
    .select("context_type, content")
    .eq("show_id", payload.showId);

  const context = {
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

  const userPrompt = `Here are the podcast hosts and their voice characteristics:\n${hostList}\n\nHere is the episode analysis to repurpose:\n${JSON.stringify(masterOutput.content, null, 2)}\n\nGenerate all platform-specific content. Make each host's content match their voice. Make Twitter threads punchy and viral. Make LinkedIn posts professional but personal. Make captions optimized for each platform's algorithm.`;

  const response = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
  });

  // Parse JSON
  let allContent: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    allContent = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    allContent = { raw: response };
  }

  // Save each output type as separate rows
  const outputTypes = ["twitter", "linkedin", "captions", "youtube_segments", "schedule", "clip_timestamps"] as const;
  const inserted: string[] = [];

  for (const outputType of outputTypes) {
    const content = allContent[outputType];
    if (!content) continue;

    // For per-host types, create separate rows per host
    if (outputType === "twitter" || outputType === "linkedin") {
      const perHost = (content as Record<string, unknown>).per_host as Record<string, unknown> | undefined;
      if (perHost && hosts) {
        for (const host of hosts) {
          const hostContent = perHost[host.name];
          if (!hostContent) continue;
          const { data } = await supabase
            .from("repurpose_outputs")
            .insert({
              episode_id: payload.episodeId,
              output_type: outputType,
              content: hostContent as Record<string, unknown>,
              host_id: host.id,
              status: "completed",
              generated_at: new Date().toISOString(),
            })
            .select()
            .single();
          if (data) inserted.push(data.id);
        }
      }
    } else {
      const { data } = await supabase
        .from("repurpose_outputs")
        .insert({
          episode_id: payload.episodeId,
          output_type: outputType,
          content: (typeof content === "object" && !Array.isArray(content) ? content : { items: content }) as Record<string, unknown>,
          status: "completed",
          generated_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (data) inserted.push(data.id);
    }
  }

  // Advance episode status
  await supabase
    .from("episodes")
    .update({ status: "content_ready", updated_at: new Date().toISOString() })
    .eq("id", payload.episodeId);

  return { outputCount: inserted.length, outputIds: inserted };
}
