import type { Job } from "bullmq";
import { logActivity, updateJobStatus } from "../lib/supabase";

export async function processAiJob(job: Job): Promise<unknown> {
  const { skillName, showId, episodeId, jobId, payload } = job.data;

  if (jobId) await updateJobStatus(jobId, "running");
  await logActivity(showId, episodeId, `skill:${skillName}:started`, {
    jobId: job.id,
  });

  try {
    let result: unknown;
    const skillPayload = { ...payload, showId, episodeId, jobId };

    switch (skillName) {
      case "research-brief":
      case "tight-questions":
      case "runsheet":
      case "hook-writing":
      case "slide-generation":
      case "repurpose-write":
      case "substack":
      case "humanizer": {
        const { callClaude } = await import("../lib/claude");
        const skill = await import(`../skills/${skillName}`);
        result = await skill.execute(skillPayload, callClaude);
        break;
      }
      case "docket-add":
      case "docket-summarise":
      case "transcript-ingest":
      case "repurpose-analyze": {
        const { callGemini } = await import("../lib/gemini");
        const skill = await import(`../skills/${skillName}`);
        result = await skill.execute(skillPayload, callGemini);
        break;
      }
      default:
        throw new Error(`Unknown AI skill: ${skillName}`);
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
