import type { SupabaseClient } from "@supabase/supabase-js";

export type ResolvedEpisode = {
  id: string;
  episode_number: number;
  title: string;
  subtitle: string | null;
  status: string;
  recording_date: string | null;
};

const SHIPPED_STATUSES = ["delivered", "posted"] as const;

export async function resolveEpisode(
  supabase: SupabaseClient,
  showId: string,
  arg: number | "latest" | undefined
): Promise<ResolvedEpisode> {
  if (typeof arg === "number") {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, episode_number, title, subtitle, status, recording_date")
      .eq("show_id", showId)
      .eq("episode_number", arg)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Episode ${arg} not found`);
    return data as ResolvedEpisode;
  }

  if (arg === "latest") {
    const { data, error } = await supabase
      .from("episodes")
      .select("id, episode_number, title, subtitle, status, recording_date")
      .eq("show_id", showId)
      .order("episode_number", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error("No episodes for show");
    return data[0] as ResolvedEpisode;
  }

  const { data: working } = await supabase
    .from("episodes")
    .select("id, episode_number, title, subtitle, status, recording_date")
    .eq("show_id", showId)
    .not("status", "in", `(${SHIPPED_STATUSES.map((s) => `"${s}"`).join(",")})`)
    .order("episode_number", { ascending: false })
    .limit(1);
  if (working?.length) return working[0] as ResolvedEpisode;

  const { data: latest, error } = await supabase
    .from("episodes")
    .select("id, episode_number, title, subtitle, status, recording_date")
    .eq("show_id", showId)
    .order("episode_number", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  if (!latest?.length) throw new Error("No episodes for show");
  return latest[0] as ResolvedEpisode;
}
