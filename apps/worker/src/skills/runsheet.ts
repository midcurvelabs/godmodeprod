import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface RunsheetPayload {
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a runsheet builder for "God Mode Pod", a tech/web3/AI podcast with three hosts: Rik, Ben, and Luca.

Build a complete production runsheet following this episode structure:
1. Coordinates (0:00–3:00) — Opening, what's up, this week's vibe
2. Boot Sequence (3:00–5:00) — Quick-fire news items, one line each
3. The Signal (5:00–15:00) — The main story/topic of the week, deep dive
4. God Mode Takes (15:00–45:00) — Hot takes on 2-3 topics, debate format
5. Rapid Fire (45:00–55:00) — Quick opinions, audience questions, trending takes
6. The Close (55:00–60:00) — Summary, CTA, what's next week

For each segment include:
- name, time_label, duration_minutes
- rik_intro: A script for Rik to read that sets up the segment (conversational, not robotic)
- seed_points: Per host (Rik, Ben, Luca), bullet points to riff on
- tight_questions: Numbered questions to keep the conversation on track
- debate_positions: What each host is likely to argue (so they can prep counterpoints)

Output ONLY valid JSON: { "segments": [...] }`;

export async function execute(
  payload: RunsheetPayload
): Promise<Record<string, unknown>> {
  // Fetch research brief + docket topics
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

  const briefContent = briefRes.data?.[0]?.content;
  const topics = topicsRes.data || [];

  let userPrompt = `Build a runsheet for Episode ${episodeRes.data?.episode_number}: "${episodeRes.data?.title}".\n\n`;

  userPrompt += `Confirmed topics (${topics.length}):\n`;
  userPrompt += topics
    .map((t, i) => `${i + 1}. ${t.title}\n   Context: ${t.context}\n   Angle: ${t.angle}`)
    .join("\n\n");

  if (briefContent) {
    userPrompt += `\n\nResearch brief available:\n${JSON.stringify(briefContent, null, 2).slice(0, 4000)}`;
  }

  const response = await callModel("runsheet", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  let runsheetContent: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    runsheetContent = jsonMatch ? JSON.parse(jsonMatch[0]) : { segments: [] };
  } catch {
    runsheetContent = { raw: response, segments: [] };
  }

  // Save to database
  const { data: runsheet } = await supabase
    .from("runsheets")
    .insert({
      episode_id: payload.episodeId,
      content: runsheetContent,
      status: "completed",
      generated_at: new Date().toISOString(),
    })
    .select()
    .single();

  // Update episode status
  await supabase
    .from("episodes")
    .update({ status: "runsheet_ready", updated_at: new Date().toISOString() })
    .eq("id", payload.episodeId);

  return { runsheetId: runsheet?.id, segments: (runsheetContent as { segments?: unknown[] }).segments?.length || 0 };
}
