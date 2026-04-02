import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface TopicInput {
  id: string;
  title: string;
  context: string;
  angle: string;
  sources: Array<{ url: string; title: string }>;
}

interface ResearchBriefPayload {
  topics: TopicInput[];
  episodeContext?: string;
  guestMode?: boolean;
  guestName?: string;
  guestBio?: string;
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a podcast research assistant for a tech/web3/AI podcast called "God Mode Pod".

Your job is to produce comprehensive research briefs for each topic that will be discussed on the show.

For each topic, output a JSON object with these fields:
- topic_title: the topic name
- what_happened: 2-3 sentences on what happened and why it matters now
- core_thesis: the central argument or position to explore
- steel_man: the strongest case FOR this position
- straw_man: the weakest/most common counterargument to knock down
- analogy: the best analogy to explain this to a smart non-expert
- data_points: array of 3 specific, verifiable data points with numbers
- sample_dialogue: a snippet of how hosts might naturally discuss this (2-3 exchanges)
- connecting_threads: array of 2-3 links to other topics, broader trends, or past episodes

Output ONLY valid JSON: { "sections": [ ... ] }`;

export async function execute(
  payload: ResearchBriefPayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  const topicList = payload.topics
    .map(
      (t, i) =>
        `${i + 1}. **${t.title}**\n   Context: ${t.context || "None provided"}\n   Angle: ${t.angle || "None provided"}\n   Sources: ${t.sources?.map((s) => s.url).join(", ") || "None"}`
    )
    .join("\n\n");

  let userPrompt = `Research these ${payload.topics.length} topics for the upcoming episode:\n\n${topicList}`;

  if (payload.episodeContext) {
    userPrompt += `\n\nEpisode framing: ${payload.episodeContext}`;
  }

  if (payload.guestMode && payload.guestName) {
    userPrompt += `\n\nThis is a guest episode with ${payload.guestName}. Bio: ${payload.guestBio || "Not provided"}. Include guest-specific research: prior interviews, greatest hits, deep questions, and flagged contradictions.`;
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

  const response = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
  });

  // Parse JSON from response
  let briefContent: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    briefContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { sections: [] };
  } catch {
    briefContent = { raw: response, sections: [] };
  }

  // Save to database
  const { data: brief } = await supabase
    .from("research_briefs")
    .insert({
      episode_id: payload.episodeId,
      content: briefContent,
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Update episode status
  await supabase
    .from("episodes")
    .update({ status: "research_ready", updated_at: new Date().toISOString() })
    .eq("id", payload.episodeId);

  return { briefId: brief?.id, sections: (briefContent as { sections?: unknown[] }).sections?.length || 0 };
}
