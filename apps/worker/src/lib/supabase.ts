import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || ""
);

export async function logActivity(
  showId: string,
  episodeId: string | null,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  await supabase.from("activity_log").insert({
    show_id: showId,
    episode_id: episodeId,
    action,
    details,
  });
}

export async function updateJobStatus(
  jobId: string,
  status: "running" | "completed" | "failed",
  result?: Record<string, unknown>,
  error?: string
): Promise<void> {
  const update: Record<string, unknown> = { status };
  if (status === "running") update.started_at = new Date().toISOString();
  if (status === "completed" || status === "failed")
    update.completed_at = new Date().toISOString();
  if (result) update.result = result;
  if (error) update.error = error;

  await supabase.from("jobs").update(update).eq("id", jobId);
}
