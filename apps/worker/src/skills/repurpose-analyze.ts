import { supabase } from "../lib/supabase";
import type { callGemini as GeminiFn } from "../lib/gemini";

interface RepurposeAnalyzePayload {
  episodeId: string;
  showId: string;
}

const SYSTEM_PROMPT = `You are a podcast content strategist. Your job is to analyze a cleaned podcast transcript and extract everything needed to repurpose the episode into multi-platform content.

Analyze the transcript thoroughly and output ONLY valid JSON:
{
  "key_moments": [
    {
      "timestamp": "approximate timestamp or segment reference",
      "description": "What happened in this moment",
      "why_it_matters": "Why this is content-worthy",
      "energy": "high | medium | low",
      "type": "hot_take | insight | debate | funny | emotional | educational"
    }
  ],
  "clip_candidates": [
    {
      "title": "Short punchy title for the clip",
      "hook": "Opening line or hook for the clip",
      "speaker": "Primary speaker name",
      "start_ref": "Approximate start reference in transcript",
      "end_ref": "Approximate end reference",
      "platform": ["tiktok", "instagram", "youtube_shorts", "twitter"],
      "estimated_duration_seconds": 45,
      "why_it_works": "Why this will perform well as a clip"
    }
  ],
  "themes": [
    {
      "name": "Theme name",
      "summary": "2-3 sentence summary",
      "related_moments": ["references to key_moments by index"]
    }
  ],
  "quotable_lines": [
    {
      "quote": "The exact quote",
      "speaker": "Speaker name",
      "context": "Brief context for why this quote matters",
      "platforms": ["twitter", "instagram", "linkedin"]
    }
  ],
  "topic_segments": [
    {
      "topic": "Topic name",
      "start_ref": "Approximate start",
      "end_ref": "Approximate end",
      "summary": "What was discussed",
      "key_takeaway": "The main takeaway from this segment"
    }
  ],
  "episode_summary": "3-4 sentence summary of the entire episode",
  "content_angles": [
    "Angle 1: description of a unique content angle",
    "Angle 2: ...",
    "Angle 3: ..."
  ]
}`;

export async function execute(
  payload: RepurposeAnalyzePayload,
  callGemini: typeof GeminiFn
): Promise<Record<string, unknown>> {
  // Fetch clean transcript
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("*")
    .eq("episode_id", payload.episodeId)
    .eq("status", "processed")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .single();

  if (!transcript?.clean_content) {
    throw new Error("No processed transcript found for this episode");
  }

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

  const userPrompt = `Analyze this podcast transcript and extract all repurposable content:\n\n${transcript.clean_content}`;

  const response = await callGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  // Parse JSON from response
  let analysis: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    analysis = { raw: response };
  }

  // Save as master repurpose output
  const { data: output } = await supabase
    .from("repurpose_outputs")
    .insert({
      episode_id: payload.episodeId,
      output_type: "master",
      content: analysis,
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Update episode status
  await supabase
    .from("episodes")
    .update({ status: "repurpose_running", updated_at: new Date().toISOString() })
    .eq("id", payload.episodeId);

  return {
    outputId: output?.id,
    moments: (analysis.key_moments as unknown[])?.length || 0,
    clips: (analysis.clip_candidates as unknown[])?.length || 0,
    themes: (analysis.themes as unknown[])?.length || 0,
    quotes: (analysis.quotable_lines as unknown[])?.length || 0,
  };
}
