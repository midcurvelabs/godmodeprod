import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface TightQuestionsPayload {
  topics: Array<{ title: string; context: string; angle: string }>;
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a podcast question writer for "God Mode Pod". You write tight, specific questions — not generic ones.

Use the 5 question types framework:
1. **The Opener** — establishes the topic and invites the host to set the scene
2. **The Devil's Advocate** — challenges the obvious take, forces nuance
3. **The Bridge** — connects this topic to something else the audience cares about
4. **The Crystal Ball** — projects forward: what does this mean in 6-12 months?
5. **The Closer** — the single takeaway or action the audience should remember

For each topic, generate 4-5 questions using different types. Label each question with its type.

Output ONLY valid JSON: { "topics": [{ "title": "...", "questions": [{ "type": "opener|devils_advocate|bridge|crystal_ball|closer", "question": "..." }] }] }`;

export async function execute(
  payload: TightQuestionsPayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  const topicList = payload.topics
    .map((t, i) => `${i + 1}. ${t.title}\n   Context: ${t.context}\n   Angle: ${t.angle}`)
    .join("\n\n");

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
    userPrompt: `Generate tight questions for these topics:\n\n${topicList}`,
    context,
    maxTokens: 4096,
  });

  let result: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    result = jsonMatch ? JSON.parse(jsonMatch[0]) : { topics: [] };
  } catch {
    result = { raw: response, topics: [] };
  }

  return result;
}
