import { supabase } from "../lib/supabase";
import type { callClaude as ClaudeFn } from "../lib/claude";

interface SubstackPayload {
  episodeId: string;
  showId: string;
  tone?: "default" | "formal" | "shorter";
  sections?: string[]; // e.g. ["intro", "topics", "pull_quotes", "links", "closing"]
}

const SYSTEM_PROMPT = `You are a podcast newsletter writer. Transform podcast episodes into compelling Substack posts.

## Writing Rules (STRICT)
- The newsletter is NOT a transcript summary. It's a standalone piece of writing.
- Write in the show's voice: casual, sharp, builder-focused, slightly contrarian.
- No em-dashes. Use commas or full stops.
- No hype words: "groundbreaking", "game-changing", "revolutionary", "vibrant", "stunning"
- Direct voice. Like the hosts talk, not a press release.
- Prose only. No bullet points in the body sections.
- Reference all three hosts where relevant. Don't make it a one-host show.

## Tone Variants
- "default": Natural show voice. Conversational but smart.
- "formal": Slightly more polished. Same personality, tighter prose.
- "shorter": Half the length. Only the sharpest insights. Cut everything that isn't essential.

## Newsletter Structure
5 sections per episode:
1. Hook/intro paragraph (make readers want to keep reading)
2-4. Topic sections covering the biggest ideas (each 150-250 words)
5. Closing POV (host perspective + CTA: watch episode, reply with thoughts)

Each section should include:
- Specific insights, hot takes, and actionable ideas from the conversation
- Host perspectives and disagreements where relevant
- Embedded tweet URLs on their own line (Substack auto-embeds them)
- Pull quotes as blockquotes (> prefix)
- Inline links to sources/tools mentioned

## Substack Notes
Additionally, generate 3-5 short notes for the Substack Notes feed:
- One idea per note
- Distributed across hosts (not all one person)
- Each note is a standalone micro-post
- Punchy, conversational, 1-3 sentences

## Subject Lines
Generate 3 subject line options:
1. Curiosity gap style
2. Bold claim style
3. Question style

Output ONLY valid JSON:
{
  "main_content": "Full markdown newsletter post. 800-1200 words for default, 400-600 for shorter.",
  "notes_content": "Markdown with ## headers separating each note. 3-5 notes total.",
  "subject_options": ["Subject 1", "Subject 2", "Subject 3"]
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

  // Fetch docket topics for link cross-referencing
  const { data: docketTopics } = await supabase
    .from("docket_topics")
    .select("title, context, sources, status")
    .eq("episode_id", payload.episodeId)
    .eq("status", "in");

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

  // Build user prompt with all available context
  const tone = payload.tone || "default";
  const sections = payload.sections || ["intro", "topics", "pull_quotes", "links", "closing"];

  let userPrompt = `Write a Substack newsletter for this podcast episode.\n\n`;
  userPrompt += `Tone: ${tone}\n`;
  userPrompt += `Include these sections: ${sections.join(", ")}\n\n`;

  if (masterOutput?.content) {
    userPrompt += `Episode analysis (use for structure and key points):\n${JSON.stringify(masterOutput.content, null, 2)}\n\n`;
  }

  if (docketTopics && docketTopics.length > 0) {
    userPrompt += `Docket topics with sources (cross-reference for links):\n${JSON.stringify(docketTopics, null, 2)}\n\n`;
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

  return {
    newsletterId: saved?.id,
    subjectCount: (newsletter.subject_options as string[])?.length || 0,
    tone,
  };
}
