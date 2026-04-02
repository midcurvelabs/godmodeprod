import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface HumanizerPayload {
  outputId: string;
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are an AI content de-robotifier. Your job is to take content that reads like AI wrote it and make it sound like a real human wrote it.

Rules:
1. Remove corporate buzzwords and generic phrases ("in today's digital landscape", "it's important to note", "game-changer")
2. Add imperfections: contractions, sentence fragments, casual transitions
3. Match the specific voice characteristics of the host provided
4. Keep the substance — just fix the delivery
5. Don't overdo it — subtle is better than forced casual
6. Vary sentence length. Use short punchy sentences. Then longer flowing ones that build on the point.
7. Remove any list formatting that feels like AI (numbered lists with parallel structure)

Output ONLY the rewritten content as valid JSON matching the exact same structure as the input. Do not add or remove fields.`;

export async function execute(
  payload: HumanizerPayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  // Fetch the output to humanize
  const { data: output } = await supabase
    .from("repurpose_outputs")
    .select("*")
    .eq("id", payload.outputId)
    .single();

  if (!output) throw new Error(`Output ${payload.outputId} not found`);

  // Fetch host voice if this output has a host_id
  let voiceNote = "";
  if (output.host_id) {
    const { data: host } = await supabase
      .from("hosts")
      .select("name, voice_characteristics")
      .eq("id", output.host_id)
      .single();
    if (host) {
      voiceNote = `\n\nThis content is for ${host.name}. Their voice: ${host.voice_characteristics || "natural and conversational"}. Match this voice exactly.`;
    }
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

  const userPrompt = `Humanize this ${output.output_type} content. Remove AI patterns, match the host voice, keep the substance.${voiceNote}\n\nContent to humanize:\n${JSON.stringify(output.content, null, 2)}`;

  const response = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
    maxTokens: 4096,
  });

  // Parse JSON
  let humanized: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    humanized = jsonMatch ? JSON.parse(jsonMatch[0]) : output.content;
  } catch {
    humanized = output.content;
  }

  // Update the output in-place
  await supabase
    .from("repurpose_outputs")
    .update({ content: humanized })
    .eq("id", payload.outputId);

  return { outputId: payload.outputId, humanized: true };
}
