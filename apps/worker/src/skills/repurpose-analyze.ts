import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface RepurposeAnalyzePayload {
  episodeId: string;
  showId: string;
}

const SYSTEM_PROMPT = `You are a podcast content strategist specializing in multi-platform repurposing. You analyze podcast transcripts to extract everything needed to create clips, social content, and newsletters.

Your analysis must be HOST-AWARE. Tag every moment, clip, and quote with the specific host who said it. Use the host names provided.

## Clip Identification Rules

Identify 5-8 clips PER HOST (15-24 total per episode). A clip needs at least ONE of:
1. Strong hook in first 5 seconds (a bold claim, surprising stat, or pattern interrupt)
2. Personal result with specificity (numbers, dates, names)
3. Relevant news peg (timely reference)
4. Named concept or reframe (a memorable phrase or mental model)
5. Entertainment/drama value (genuine disagreement, humor, shock)

## Priority System
- Priority 1 (highest): Strongest hook, broadest appeal. These get posted first (days 1-3). Target 4-6 per episode.
- Priority 2: Strong but niche. Mid-week content (days 3-5). Target 6-10 per episode.
- Priority 3: Good content, lower urgency. Weekend/holdback content.

## Hook Rules
- Hook = the opening line of the clip. Max 8 words.
- Must work as a standalone scroll-stopper.
- Never start with "In this clip", "So basically", or "What I want to say is".

Output ONLY valid JSON:
{
  "episode_summary": "3-4 sentence summary of the entire episode",
  "coverage_note": "One sentence describing how well the actual conversation matched the planned docket. Empty string if no docket topics were provided.",
  "key_moments": [
    {
      "host": "Host name who drove this moment",
      "timestamp": "Approximate timestamp or segment reference from transcript",
      "description": "What happened in this moment",
      "why_it_matters": "Why this is content-worthy",
      "energy": "high | medium | low",
      "type": "hot_take | insight | debate | funny | emotional | educational"
    }
  ],
  "clip_candidates": [
    {
      "host": "Primary speaker name",
      "title": "Short punchy title for the clip (max 8 words)",
      "hook": "Opening line or hook for the clip (max 8 words, must be a scroll-stopper)",
      "start_ref": "Approximate start reference in transcript",
      "end_ref": "Approximate end reference",
      "estimated_duration_seconds": 45,
      "priority": 1,
      "platforms": ["tiktok", "instagram", "youtube_shorts"],
      "why_it_works": "Why this will perform well as a clip",
      "criteria_met": ["strong_hook", "personal_result", "news_peg", "named_concept", "entertainment"],
      "docket_topic_id": null
    }
  ],
  "themes": [
    {
      "name": "Theme name",
      "summary": "2-3 sentence summary",
      "hosts_involved": ["Host names who contributed to this theme"],
      "related_moment_indices": [0, 2, 5]
    }
  ],
  "quotable_lines": [
    {
      "quote": "The exact quote from the transcript",
      "host": "Speaker name",
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
      "key_takeaway": "The main takeaway from this segment",
      "hosts_present": ["Host names active in this segment"]
    }
  ],
  "content_angles": [
    {
      "angle": "Description of a unique content angle",
      "best_for": "twitter | linkedin | youtube | newsletter",
      "host_focus": "Which host this angle centers on"
    }
  ],
  "host_clip_summary": {
    "HOST_NAME": { "total_clips": 7, "priority_1": 2, "priority_2": 3, "priority_3": 2 }
  }
}

IMPORTANT:
- Every host must have 5-8 clips. If you have fewer, re-scan the transcript.
- Priority 1 clips must have genuinely strong hooks.
- Timestamps must reference actual transcript positions.
- Quotable lines must be EXACT quotes, not paraphrased.
- If a "Docket topics" list is provided, for each clip set "docket_topic_id" to the UUID of the matching topic when the clip's content clearly maps to that topic. Match on substance (the clip is about that topic), not just keyword overlap. If unsure, leave "docket_topic_id" as null.
- If a "Runsheet segment structure" is provided, use those exact segment names (e.g. "The Signal", "God Mode Takes") in the "topic" field of topic_segments when a segment aligns.
- Produce "coverage_note" as a single sentence summarizing docket coverage: mention topics that were skipped or covered in <30 seconds. If no docket was provided, set "coverage_note" to "".`;

export async function execute(
  payload: RepurposeAnalyzePayload
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

  // Fetch docket topics, runsheet, hosts, and show context in parallel (all independent of each other).
  const [
    { data: docketTopics },
    { data: runsheetRows },
    { data: hosts },
    { data: showContextRows },
  ] = await Promise.all([
    supabase
      .from("docket_topics")
      .select("id, title, context, angle, original_url, original_image_url")
      .eq("episode_id", payload.episodeId)
      .eq("status", "in")
      .order("sort_order"),
    supabase
      .from("runsheets")
      .select("content")
      .eq("episode_id", payload.episodeId)
      .order("generated_at", { ascending: false })
      .limit(1),
    supabase
      .from("hosts")
      .select("id, name, role, voice_characteristics, clip_style")
      .eq("show_id", payload.showId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("show_context")
      .select("context_type, content")
      .eq("show_id", payload.showId),
  ]);

  const runsheetContent = runsheetRows?.[0]?.content as { segments?: Array<Record<string, unknown>> } | null | undefined;

  const hostList = (hosts || [])
    .map((h) => `- ${h.name} (${h.role || "host"}): voice=${h.voice_characteristics || "natural"}, clip_style=${h.clip_style || "not specified"}`)
    .join("\n");

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

  // Build docket block (omitted entirely if empty — e.g. solo episode with no confirmed topics)
  const docketBlock = (docketTopics && docketTopics.length > 0)
    ? `\nDocket topics for this episode (match clips back to these by id when substance aligns):\n${JSON.stringify(
        docketTopics.map((t) => ({
          id: t.id,
          title: t.title,
          context: t.context,
          angle: t.angle,
          has_source: Boolean(t.original_url),
        })),
        null,
        2
      )}\n`
    : "";

  // Build runsheet block — pass only segment names + time labels; skip seed_points (too large, not needed for clip attribution)
  const runsheetBlock = runsheetContent?.segments?.length
    ? `\nRunsheet segment structure (use these segment names in topic_segments when segments align):\n${JSON.stringify(
        runsheetContent.segments.map((s) => ({
          name: s.name,
          time_label: s.time_label,
          duration_minutes: s.duration_minutes,
        })),
        null,
        2
      )}\n`
    : "";

  const userPrompt = `Here are the podcast hosts. You MUST identify 5-8 clips per host:\n${hostList}\n${docketBlock}${runsheetBlock}\nAnalyze this podcast transcript and extract all repurposable content:\n\n${transcript.clean_content}`;

  const response = await callModel("repurpose-analyze", {
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

  // Build summary
  const clips = analysis.clip_candidates as Array<{ host?: string; priority?: number }> | undefined;
  const hostSummary = analysis.host_clip_summary as Record<string, unknown> | undefined;

  return {
    outputId: output?.id,
    moments: (analysis.key_moments as unknown[])?.length || 0,
    clips: clips?.length || 0,
    themes: (analysis.themes as unknown[])?.length || 0,
    quotes: (analysis.quotable_lines as unknown[])?.length || 0,
    angles: (analysis.content_angles as unknown[])?.length || 0,
    hostClipSummary: hostSummary || {},
  };
}
