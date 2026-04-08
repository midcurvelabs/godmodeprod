import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface SlideGenerationPayload {
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a slide designer for a tech/web3/AI podcast. You create text-based presentation slides that hosts display on-screen during recording.

Slide types:
- title_card: Episode title + subtitle, sets the tone
- topic_intro: Introduces a topic with 2-3 framing bullets
- data_point: One key stat or data point with context (use data_value + data_label fields)
- talking_point: Core thesis or argument with supporting bullets
- quote: A notable quote relevant to the topic
- closer: Wrap-up slide with key takeaways

Rules:
- Generate 8-15 slides total
- Start with 1 title_card, end with 1 closer
- For each topic: 1 topic_intro, 1-2 data_points (from research), 1 talking_point
- Keep headings under 60 characters
- Bullets should be concise (under 100 chars each), max 4 per slide
- speaker_notes are private hints for the presenter (1-2 sentences)
- data_value should be a single number or short stat, data_label explains it

Output ONLY valid JSON:
{
  "slides": [
    {
      "type": "title_card",
      "heading": "...",
      "bullets": ["..."],
      "speaker_notes": "..."
    }
  ]
}`;

export async function execute(
  payload: SlideGenerationPayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  const [briefRes, topicsRes, showContextRes, episodeRes] = await Promise.all([
    supabase
      .from("research_briefs")
      .select("content")
      .eq("episode_id", payload.episodeId)
      .order("generated_at", { ascending: false })
      .limit(1),
    supabase
      .from("docket_topics")
      .select("title, context, angle")
      .eq("episode_id", payload.episodeId)
      .eq("status", "in")
      .order("sort_order"),
    supabase
      .from("show_context")
      .select("context_type, content")
      .eq("show_id", payload.showId),
    supabase
      .from("episodes")
      .select("episode_number, title")
      .eq("id", payload.episodeId)
      .single(),
  ]);

  const context = {
    show_slug: "",
    soul: {} as Record<string, unknown>,
    hosts: {} as Record<string, unknown>,
    brand: {} as Record<string, unknown>,
    workflow: {} as Record<string, unknown>,
    assets_path: "",
    episode_number: episodeRes.data?.episode_number || 0,
    episode_id: payload.episodeId,
  };

  if (showContextRes.data) {
    for (const row of showContextRes.data) {
      context[row.context_type as keyof typeof context] = row.content;
    }
  }

  const briefContent = briefRes.data?.[0]?.content as Record<string, unknown> | undefined;
  const topics = topicsRes.data || [];

  let userPrompt = `Create presentation slides for Episode ${episodeRes.data?.episode_number}: "${episodeRes.data?.title}".\n\n`;

  userPrompt += `Confirmed topics (${topics.length}):\n`;
  userPrompt += topics
    .map((t, i) => `${i + 1}. ${t.title}\n   Context: ${t.context}\n   Angle: ${t.angle}`)
    .join("\n\n");

  if (briefContent) {
    userPrompt += `\n\nResearch brief (use data_points and core_thesis for slides):\n${JSON.stringify(briefContent, null, 2).slice(0, 6000)}`;
  }

  const response = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
    maxTokens: 4096,
  });

  let slidesContent: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    slidesContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { slides: [] };
  } catch {
    slidesContent = { raw: response, slides: [] };
  }

  // Snapshot brand style from show context
  const brandCtx = context.brand as Record<string, unknown>;
  const style = {
    brandColor: (brandCtx.brandColor as string) || "#E8001D",
    font: (brandCtx.slideFont as string) || "Inter",
    layout: (brandCtx.slideLayout as string) || "minimal",
  };

  const { data: slides } = await supabase
    .from("episode_slides")
    .insert({
      episode_id: payload.episodeId,
      content: slidesContent,
      style,
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  return {
    slidesId: slides?.id,
    slideCount: (slidesContent as { slides?: unknown[] }).slides?.length || 0,
  };
}
