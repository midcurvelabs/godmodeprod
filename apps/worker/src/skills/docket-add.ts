import { supabase } from "../lib/supabase";
import type { callGemini as GeminiFn } from "../lib/gemini";

interface DocketAddPayload {
  topicId: string;
  showId: string;
  episodeId: string;
  url?: string;
  rawText?: string;
}

const SYSTEM_PROMPT = `You are a podcast topic researcher for a tech/web3/AI podcast.

Given a link or raw topic text, expand it into a structured docket entry with:
1. A clear, punchy title (if the original is vague, improve it)
2. Context: 2-3 sentences on what happened and why it matters NOW
3. Angle: the specific lens or take the hosts should explore (not just "discuss this")
4. Sources: relevant links with titles (if a URL was provided, include it plus any related sources you know about)

Your job is to give hosts enough context to decide if this topic is IN or OUT for the episode, and enough angle to make the conversation interesting.

Output ONLY valid JSON:
{
  "title": "Improved topic title",
  "context": "What happened and why it matters",
  "angle": "The specific take or lens to explore",
  "sources": [{ "url": "https://...", "title": "Source title" }]
}`;

export async function execute(
  payload: DocketAddPayload,
  callGemini: typeof GeminiFn
): Promise<Record<string, unknown>> {
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

  let userPrompt = "";
  if (payload.url) {
    userPrompt = `Expand this link into a docket entry:\n\nURL: ${payload.url}`;
  } else if (payload.rawText) {
    userPrompt = `Expand this topic into a docket entry:\n\n${payload.rawText}`;
  } else {
    // Fetch the existing topic title as input
    const { data: topic } = await supabase
      .from("docket_topics")
      .select("title")
      .eq("id", payload.topicId)
      .single();
    userPrompt = `Expand this topic into a docket entry:\n\n${topic?.title || "Unknown topic"}`;
  }

  const response = await callGemini({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  // Parse JSON from response
  let parsed: { title?: string; context?: string; angle?: string; sources?: Array<{ url: string; title: string }> };
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  // Update the docket topic
  const updates: Record<string, unknown> = {};
  if (parsed.context) updates.context = parsed.context;
  if (parsed.angle) updates.angle = parsed.angle;
  if (parsed.sources) updates.sources = parsed.sources;
  if (parsed.title) updates.title = parsed.title;

  if (Object.keys(updates).length > 0) {
    await supabase
      .from("docket_topics")
      .update(updates)
      .eq("id", payload.topicId);
  }

  return { topicId: payload.topicId, enriched: true, ...parsed };
}
