import type { Job } from "bullmq";
import { logActivity, updateJobStatus } from "../lib/supabase";

// Known AI skill names. Keep in sync with files in ../skills/.
const AI_SKILLS = new Set([
  "research-brief",
  "tight-questions",
  "runsheet",
  "hook-writing",
  "slide-generation",
  "repurpose-write",
  "substack",
  "humanizer",
  "docket-add",
  "docket-summarise",
  "guest-enrich",
  "transcript-ingest",
  "repurpose-analyze",
]);

export async function processAiJob(job: Job): Promise<unknown> {
  const { skillName, showId, episodeId, jobId, payload } = job.data;

  if (jobId) await updateJobStatus(jobId, "running");
  await logActivity(showId, episodeId, `skill:${skillName}:started`, {
    jobId: job.id,
  });

  try {
    if (!AI_SKILLS.has(skillName)) {
      throw new Error(`Unknown AI skill: ${skillName}`);
    }

    const skillPayload = { ...payload, showId, episodeId, jobId };
    const skill = await import(`../skills/${skillName}`);

    // Skills now use lib/router.ts internally — no DI needed.
    const result = await skill.execute(skillPayload);

    if (jobId)
      await updateJobStatus(jobId, "completed", result as Record<string, unknown>);
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
