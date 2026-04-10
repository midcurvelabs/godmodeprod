import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface DocketSummarisePayload {
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a podcast episode planner for a tech/web3/AI podcast.

Given the confirmed topic lineup for an upcoming episode, produce:
1. A concise summary of what this episode will cover (3-4 sentences)
2. The narrative arc — how topics connect and flow into each other
3. 3-5 episode title options (punchy, clickable, platform-native)

The summary should help hosts prepare mentally and help the audience know what to expect.

Output ONLY valid JSON:
{
  "summary": "Episode summary paragraph",
  "narrative_arc": "How topics connect and the flow of the episode",
  "title_options": ["Title option 1", "Title option 2", "Title option 3"]
}`;

export async function execute(
  payload: DocketSummarisePayload
): Promise<Record<string, unknown>> {
  // Fetch confirmed topics
  const { data: topics } = await supabase
    .from("docket_topics")
    .select("title, context, angle, sources, sort_order")
    .eq("episode_id", payload.episodeId)
    .eq("status", "in")
    .order("sort_order");

  if (!topics || topics.length === 0) {
    return { error: "No confirmed topics found for this episode" };
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

  const topicList = topics
    .map(
      (t, i) =>
        `${i + 1}. **${t.title}**\n   Context: ${t.context || "None"}\n   Angle: ${t.angle || "None"}`
    )
    .join("\n\n");

  const userPrompt = `Summarize this episode's confirmed lineup (${topics.length} topics):\n\n${topicList}`;

  const response = await callModel("docket-summarise", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  // Parse JSON
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { raw: response };
  } catch {
    parsed = { raw: response };
  }

  return parsed;
}
