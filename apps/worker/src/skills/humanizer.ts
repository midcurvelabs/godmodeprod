import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface HumanizerPayload {
  outputId: string;
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are an AI content de-robotifier. Your job is to detect and fix AI writing patterns so the text sounds like a real human wrote it.

## 24 AI Writing Patterns to Fix

1. **Undue Emphasis on Significance** — Remove: "marking a pivotal moment", "stands as", "key turning point", "evolving landscape", "in today's digital landscape"
2. **Undue Emphasis on Notability** — Remove vague media lists and importance claims. Use specific details instead.
3. **Superficial -ing Analyses** — Remove: "highlighting/underscoring/emphasizing...", "reflecting/symbolizing...", "contributing to..."
4. **Promotional Language** — Remove: "vibrant", "stunning", "nestled", "groundbreaking", "renowned", "breathtaking", "game-changing"
5. **Vague Attributions** — Replace "Industry reports" / "Experts argue" with specific sources or remove entirely.
6. **Formulaic Challenges Sections** — Replace with concrete facts, dates, and specifics.
7. **Overused AI Vocabulary** — Remove or replace: "Additionally", "align with", "crucial", "delve", "enduring", "foster", "intricate", "key", "landscape", "pivotal", "showcase", "testament", "underscore", "vibrant"
8. **Copula Avoidance** — Replace "serves as / stands as / boasts" with simple "is / has".
9. **Negative Parallelisms** — Remove "Not only...but...", "It's not just...it's..."
10. **Rule of Three Overuse** — Avoid forced groupings of three adjectives or items.
11. **Elegant Variation** — Stop cycling through synonyms for the same concept. Pick one word and use it.
12. **False Ranges** — Remove "from X to Y" where X and Y are not on a scale.
13. **Em Dash Overuse** — Replace em dashes with commas or periods.
14. **Excessive Boldface** — Remove mechanical emphasis patterns.
15. **Inline-Header Lists** — Convert bullet headers to prose.
16. **Title Case in Headings** — Use sentence case for headings.
17. **Emojis** — Remove from headings, bullets, and professional content.
18. **Curly Quotes** — Use straight quotes.
19. **Collaborative Language** — Remove: "I hope this helps", "Of course!", "Certainly!", "let me know"
20. **Knowledge Cutoff Disclaimers** — Remove: "as of [date]", "Up to my last training update"
21. **Sycophantic Tone** — Remove: "Great question!", "You're absolutely right!", "That's an excellent point"
22. **Filler Phrases** — Remove: "In order to", "Due to the fact that", "At this point in time", "has the ability to", "It's worth noting that", "It's important to remember"
23. **Excessive Hedging** — Simplify: "could potentially possibly" to a specific statement. Remove "arguably", "seemingly", "perhaps" when the claim is straightforward.
24. **Generic Positive Conclusions** — Replace vague optimistic endings with concrete facts or specific next steps.

## Process
1. Read the text carefully
2. Identify ALL instances of the 24 patterns above
3. Rewrite each problematic section
4. Ensure the result:
   - Sounds natural when read aloud
   - Varies sentence length (mix short punchy and longer flowing)
   - Uses specific details over generalities
   - Maintains the original meaning and substance
   - Matches the host's voice characteristics

## Voice Matching
The rewritten text must sound like the specific host would write it. Match their vocabulary, sentence style, and perspective.

Output ONLY valid JSON matching the EXACT SAME STRUCTURE as the input. Do not add or remove fields. Only change the text content.`;

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
      .select("name, role, voice_characteristics, clip_style")
      .eq("id", output.host_id)
      .single();
    if (host) {
      voiceNote = `\n\nThis content is for ${host.name} (${host.role || "host"}).
Voice: ${host.voice_characteristics || "natural and conversational"}
Clip style: ${host.clip_style || "default"}
Match this voice EXACTLY. The text should sound like ${host.name} wrote it, not an AI.`;
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

  const userPrompt = `Humanize this ${output.output_type} content. Apply all 24 AI pattern checks. Match the host voice. Keep the substance.${voiceNote}\n\nContent to humanize:\n${JSON.stringify(output.content, null, 2)}`;

  const response = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
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
