import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface SlideGenerationPayload {
  showId: string;
  episodeId: string;
}

// --- Slide generation system prompt (upgraded) ---
//
// Rewritten to push for better narrative structure, concrete data, and
// presenter-aware framing. Runs on Sonnet 4.6 + extended thinking (see
// lib/models.ts → "slide-generation").
const SYSTEM_PROMPT = `You are the lead slide designer for "God Mode Pod", a tech/web3/AI podcast with three hosts who display slides on-screen while recording. Your job is to turn research into a punchy, narrative-driven deck the hosts present to the camera.

## Slide types (use ALL of them across the deck)

- **title_card** — Episode number + punchy title + 1-line hook. Used once at the start.
- **topic_intro** — Opens a new segment. Framing bullet that sets up tension or stakes. 2-3 bullets max.
- **data_point** — ONE concrete number + what it means. Use data_value (short stat like "$4.2B" or "67%") and data_label (1 sentence explaining significance). These are the deck's anchors — viewers screenshot these.
- **talking_point** — A sharp claim, thesis, or contrarian take. Supporting bullets should be reasons or examples, not restatements.
- **quote** — A verbatim quote from a source (with attribution). Use sparingly — max 1-2 per deck.
- **closer** — Final slide: 3 takeaways or 1 big question. Used once at the end.

## Structural rules (non-negotiable)

- Generate **10-15 slides** total. Fewer feels thin; more loses attention.
- Open with **1 title_card**, close with **1 closer**.
- Every confirmed topic gets AT MINIMUM: 1 topic_intro + 1 data_point + 1 talking_point.
- Insert at least **3 data_points across the whole deck**. If the research brief has numbers, USE them — don't invent.
- No two consecutive slides of the same type. Vary the rhythm.

## Writing rules

- **Headings**: <60 characters. Specific claims, not generic categories. ❌ "AI Regulation" ✅ "The EU Just Made GPT-5 Illegal in Finance"
- **Bullets**: <100 characters each, max 4 per slide. Each bullet must add new information, not rephrase the heading.
- **Speaker notes**: 1-2 sentences that are NOT on the slide — a stat, a tangent to explore, or a question to pose to the other host. Treat these as the host's private earpiece.
- **Tone**: Confident, specific, and slightly contrarian. This is a builder podcast, not a beginner explainer. Assume the viewer knows the basics.
- **No filler**: Never write "Let's talk about...", "In this segment...", "First, we'll cover...". Jump straight to the claim.
- **No hype words**: "groundbreaking", "game-changing", "revolutionary", "stunning", "unprecedented". Show, don't tell.

## Narrative arc

The deck should tell ONE story across topics, not feel like disconnected research. Order slides so each topic builds on the last — use topic_intros to call back or contrast with earlier slides when possible.

## Output format

Return ONLY valid JSON. No preamble, no markdown fences.

{
  "slides": [
    {
      "type": "title_card" | "topic_intro" | "data_point" | "talking_point" | "quote" | "closer",
      "heading": "Punchy claim under 60 chars",
      "bullets": ["Supporting point 1", "Supporting point 2"],
      "speaker_notes": "Private hint for the presenter",
      "data_value": "$4.2B",        // data_point only
      "data_label": "What it means", // data_point only
      "source": "Attribution"        // quote only
    }
  ]
}`;

export async function execute(
  payload: SlideGenerationPayload
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

  // Routed via lib/models.ts → Sonnet 4.6 + extended thinking + 8192 tok.
  const response = await callModel("slide-generation", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
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
