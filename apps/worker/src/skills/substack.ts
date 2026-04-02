import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface SubstackPayload {
  episodeId: string;
  showId: string;
}

const SYSTEM_PROMPT = `You are a podcast newsletter writer. Your job is to transform a podcast episode into a compelling Substack newsletter post.

The newsletter should NOT be a transcript summary. It should be:
- A standalone piece of writing that captures the energy and insights of the episode
- Written in the show's voice (casual, sharp, builder-focused)
- Structured for email readers who may not have watched the episode
- Full of specific insights, hot takes, and actionable ideas from the conversation

Output ONLY valid JSON:
{
  "main_content": "Full markdown newsletter post. Use ## for sections, **bold** for emphasis, > for pull quotes. Include:\n- Hook/intro paragraph that makes readers want to keep reading\n- 3-4 sections covering the biggest ideas from the episode\n- Host perspectives and disagreements where relevant\n- Specific examples, numbers, or tools mentioned\n- Closing CTA (watch the full episode, reply with thoughts, etc.)\n\nTarget: 800-1200 words.",
  "notes_content": "Bullet-point show notes in markdown:\n- Timestamps with descriptions\n- Links mentioned in the episode\n- Tools, projects, or resources referenced\n- Guest info (if applicable)",
  "subject_options": [
    "Subject line 1 (curiosity gap)",
    "Subject line 2 (bold claim)",
    "Subject line 3 (question)",
    "Subject line 4 (number-driven)",
    "Subject line 5 (contrarian take)"
  ]
}`;

export async function execute(
  payload: SubstackPayload,
  callClaude: typeof ClaudeFn
): Promise<Record<string, unknown>> {
  // Fetch clean transcript
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("clean_content")
    .eq("episode_id", payload.episodeId)
    .eq("status", "processed")
    .order("uploaded_at", { ascending: false })
    .limit(1)
    .single();

  // Fetch master analysis if available
  const { data: masterOutput } = await supabase
    .from("repurpose_outputs")
    .select("content")
    .eq("episode_id", payload.episodeId)
    .eq("output_type", "master")
    .order("generated_at", { ascending: false })
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

  let userPrompt = `Write a Substack newsletter for this podcast episode.\n\n`;

  if (masterOutput?.content) {
    userPrompt += `Episode analysis (use this for structure and key points):\n${JSON.stringify(masterOutput.content, null, 2)}\n\n`;
  }

  userPrompt += `Full transcript:\n${transcript.clean_content}`;

  const response = await callClaude({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
    maxTokens: 8192,
  });

  // Parse JSON
  let newsletter: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    newsletter = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    newsletter = { main_content: response, notes_content: "", subject_options: [] };
  }

  // Save to database
  const { data: saved } = await supabase
    .from("newsletters")
    .insert({
      episode_id: payload.episodeId,
      main_content: (newsletter.main_content as string) || "",
      notes_content: (newsletter.notes_content as string) || "",
      subject_options: (newsletter.subject_options as string[]) || [],
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Newsletter doesn't advance episode status (parallel output)

  return {
    newsletterId: saved?.id,
    subjectCount: (newsletter.subject_options as string[])?.length || 0,
  };
}
