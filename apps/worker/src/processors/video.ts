import type { Job } from "bullmq";
import { logActivity, updateJobStatus } from "../lib/supabase";

export async function processVideoJob(job: Job): Promise<unknown> {
  const { skillName, showId, episodeId, jobId, payload } = job.data;

  if (jobId) await updateJobStatus(jobId, "running");
  await logActivity(showId, episodeId, `skill:${skillName}:started`, {
    jobId: job.id,
  });

  try {
    let result: unknown;

    switch (skillName) {
      case "mashup-maker": {
        const skill = await import("../skills/mashup-maker");
        result = await skill.execute(payload);
        break;
      }
      default:
        throw new Error(`Video skill not yet implemented: ${skillName}`);
    }

    if (jobId) await updateJobStatus(jobId, "completed", result as Record<string, unknown>);
    await logActivity(showId, episodeId, `skill:${skillName}:completed`, {
      jobId: job.id,
    });

    return result;
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
