import { supabase } from "../lib/supabase";
import { callModel } from "../lib/router";

interface TranscriptIngestPayload {
  transcriptId: string;
  showId: string;
  episodeId: string;
}

const SYSTEM_PROMPT = `You are a podcast transcript processor. Your job is to take a raw podcast transcript and produce a clean, well-formatted version with accurate speaker tagging.

Tasks:
1. Remove filler words (um, uh, like, you know) unless they add comedic or dramatic effect
2. Fix obvious transcription errors and normalize formatting
3. Tag each line with the correct speaker name using the host list provided
4. Break into logical paragraphs (one per thought/topic shift)
5. Preserve timestamps if present in the original

Output ONLY valid JSON:
{
  "clean_content": "The full cleaned transcript as a string with speaker tags like [Rik]: ...",
  "speaker_tags": {
    "speaker_name": {
      "line_count": 42,
      "word_count": 1500,
      "first_appearance": "00:00:12"
    }
  },
  "word_count": 12345,
  "summary": "2-3 sentence summary of the episode content"
}`;

export async function execute(
  payload: TranscriptIngestPayload
): Promise<Record<string, unknown>> {
  // Fetch raw transcript
  const { data: transcript } = await supabase
    .from("transcripts")
    .select("*")
    .eq("id", payload.transcriptId)
    .single();

  if (!transcript) throw new Error(`Transcript ${payload.transcriptId} not found`);

  // Fetch hosts for speaker matching
  const { data: hosts } = await supabase
    .from("hosts")
    .select("id, name, voice_characteristics")
    .eq("show_id", payload.showId);

  const hostList = (hosts || [])
    .map((h) => `- ${h.name} (voice: ${h.voice_characteristics || "not specified"})`)
    .join("\n");

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

  const userPrompt = `Here are the podcast hosts:\n${hostList}\n\nHere is the raw transcript to process:\n\n${transcript.raw_content}`;

  const response = await callModel("transcript-ingest", {
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    context,
  });

  // Parse JSON from response
  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = { clean_content: response, speaker_tags: {}, word_count: 0 };
  }

  // Update transcript row
  await supabase
    .from("transcripts")
    .update({
      clean_content: parsed.clean_content as string,
      speaker_tags: parsed.speaker_tags as Record<string, unknown>,
      word_count: (parsed.word_count as number) || 0,
      status: "processed",
    })
    .eq("id", payload.transcriptId);

  // Advance episode status
  // Handle edge case: if at runsheet_ready, bump to recording first
  const { data: episode } = await supabase
    .from("episodes")
    .select("status")
    .eq("id", payload.episodeId)
    .single();

  if (episode?.status === "runsheet_ready") {
    await supabase
      .from("episodes")
      .update({ status: "recording", updated_at: new Date().toISOString() })
      .eq("id", payload.episodeId);
  }

  await supabase
    .from("episodes")
    .update({ status: "transcript_received", updated_at: new Date().toISOString() })
    .eq("id", payload.episodeId);

  return {
    transcriptId: payload.transcriptId,
    wordCount: parsed.word_count,
    speakers: Object.keys((parsed.speaker_tags as Record<string, unknown>) || {}),
  };
}
