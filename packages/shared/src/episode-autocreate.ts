import type { SupabaseClient } from "@supabase/supabase-js";
import type { Episode } from "./types";

/**
 * Returns the next Thursday strictly after `from`.
 * If `from` is itself a Thursday, the result is `from + 7 days`.
 */
export function nextThursday(from: Date): Date {
  const THURSDAY = 4; // Sun=0 ... Sat=6
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // Days to add: always strictly >0. If today is Thu (4), jump 7.
  const diff = day === THURSDAY ? 7 : (THURSDAY - day + 7) % 7;
  d.setDate(d.getDate() + diff);
  return d;
}

function toDateOnly(d: Date): string {
  // YYYY-MM-DD for the `date` column in Postgres.
  return d.toISOString().slice(0, 10);
}

/**
 * Return the highest-numbered episode for the show. Rollover is manual —
 * a new episode is only created via the dashboard "New Episode" modal or the
 * Telegram `/new-episode` command. The one exception is bootstrap: if the
 * show has no episodes at all, EP 01 is created so the first capture has
 * somewhere to land.
 */
export async function ensureLatestEpisode(
  supabase: SupabaseClient,
  showId: string,
  now: Date = new Date()
): Promise<Episode> {
  const { data: latestRows, error: selectError } = await supabase
    .from("episodes")
    .select("*")
    .eq("show_id", showId)
    .order("episode_number", { ascending: false })
    .limit(1);

  if (selectError) throw selectError;

  if (latestRows && latestRows.length > 0) {
    return latestRows[0] as Episode;
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return createEpisode(supabase, showId, 1, toDateOnly(nextThursday(today)));
}

async function createEpisode(
  supabase: SupabaseClient,
  showId: string,
  episodeNumber: number,
  recordingDate: string
): Promise<Episode> {
  const { data, error } = await supabase
    .from("episodes")
    .insert({
      show_id: showId,
      episode_number: episodeNumber,
      title: `EP ${String(episodeNumber).padStart(2, "0")}`,
      recording_date: recordingDate,
      status: "created",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Episode;
}
