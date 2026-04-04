import { supabase } from "../lib/supabase";

interface MashupPayload {
  episodeId: string;
  showId: string;
  clipIds: string[];
  musicUrl: string | null;
  transitionStyle: string;
  outputIds: string[];
}

/**
 * Mashup Maker — stub implementation.
 * Real ffmpeg processing will be added later.
 * For now, marks all outputs as completed with placeholder URLs.
 */
export async function execute(payload: MashupPayload): Promise<{ outputIds: string[] }> {
  const { outputIds } = payload;

  for (const outputId of outputIds) {
    await supabase
      .from("mashup_outputs")
      .update({
        status: "completed",
        output_url: null, // Will be a real URL once ffmpeg processing is implemented
      })
      .eq("id", outputId);
  }

  return { outputIds };
}
