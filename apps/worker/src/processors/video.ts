import type { Job } from "bullmq";
import { logActivity, updateJobStatus } from "../lib/supabase";

export async function processVideoJob(job: Job): Promise<unknown> {
  const { skillName, showId, episodeId, jobId } = job.data;

  if (jobId) await updateJobStatus(jobId, "running");
  await logActivity(showId, episodeId, `skill:${skillName}:started`, {
    jobId: job.id,
  });

  try {
    // Video processing skills will be implemented in Phase 3
    throw new Error(`Video skill not yet implemented: ${skillName}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jobId) await updateJobStatus(jobId, "failed", undefined, message);
    await logActivity(showId, episodeId, `skill:${skillName}:failed`, {
      jobId: job.id,
      error: message,
    });
    throw error;
  }
}
