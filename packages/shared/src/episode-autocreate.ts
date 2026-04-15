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
 * Ensure there is a usable "latest" episode for the given show, auto-advancing
 * to a new episode scheduled for the next Thursday whenever the previous
 * recording date has passed.
 *
 * Rules:
 *   1. No episodes exist          → create EP 01, recording next Thursday.
 *   2. Latest has no recording_date → return latest as-is (user hasn't scheduled).
 *   3. Latest.recording_date < today → create EP N+1, recording next Thursday.
 *   4. Otherwise                   → return latest.
 *
 * The function is additive — desktop flows that select an episode manually
 * continue to work; this is intended for surfaces (mobile, Telegram bot) that
 * need a sensible default with zero taps.
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

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 1. No episodes → create EP 01.
  if (!latestRows || latestRows.length === 0) {
    return createEpisode(supabase, showId, 1, toDateOnly(nextThursday(today)));
  }

  const latest = latestRows[0] as Episode;

  // 2. No recording date — user hasn't set it yet, don't advance.
  if (!latest.recording_date) return latest;

  const recording = new Date(latest.recording_date);
  recording.setHours(0, 0, 0, 0);

  // 3. Past recording date → new episode.
  if (recording.getTime() < today.getTime()) {
    return createEpisode(
      supabase,
      showId,
      latest.episode_number + 1,
      toDateOnly(nextThursday(today))
    );
  }

  // 4. Current or future recording — use it.
  return latest;
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
