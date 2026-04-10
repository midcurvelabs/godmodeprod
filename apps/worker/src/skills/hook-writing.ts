import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface HookWritingPayload {
  episodeTitle: string;
  episodeNumber: number;
  topics: Array<{ title: string; angle: string }>;
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a hook writer for "God Mode Pod". You write hooks that make people stop scrolling and click play.

Rules:
- YouTube titles: 3 options, each under 60 chars, pattern-interrupt style
- YouTube description: first 2 lines are the hook (they show before "Show more")
- Podcast description: direct, benefit-driven, mentions specific topics
- Email subject: curiosity gap or bold claim, under 50 chars
- Opening tweet: thread-starter that works standalone, no hashtags

Output ONLY valid JSON:
{
  "youtube_titles": ["...", "...", "..."],
  "youtube_desc": "...",
  "podcast_desc": "...",
  "email_subject": "...",
  "opening_tweet": "..."
}`;

export async function execute(
  payload: HookWritingPayload
): Promise<Record<string, unknown>> {
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
    episode_number: payload.episodeNumber,
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

  const topicList = payload.topics.map((t) => `- ${t.title} (${t.angle})`).join("\n");

  const response = await callModel("hook-writing", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt: `Write hooks for Episode ${payload.episodeNumber}: "${payload.episodeTitle}"\n\nTopics:\n${topicList}`,
    context,
  });

  let hookData: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    hookData = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    hookData = { raw: response };
  }

  // Save to hooks table
  await supabase.from("hooks").insert({
    episode_id: payload.episodeId,
    youtube_titles: hookData.youtube_titles || [],
    youtube_desc: hookData.youtube_desc || "",
    podcast_desc: hookData.podcast_desc || "",
    email_subject: hookData.email_subject || "",
    opening_tweet: hookData.opening_tweet || "",
    generated_at: new Date().toISOString(),
  });

  return hookData;
}
