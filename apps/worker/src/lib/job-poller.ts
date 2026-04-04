import { supabase } from "./supabase";
import {
  aiJobsQueue,
  videoJobsQueue,
  mediaJobsQueue,
  deliveryJobsQueue,
} from "../queues";
import type { Queue } from "bullmq";

const POLL_INTERVAL = Number(process.env.POLL_INTERVAL_MS) || 5000;
const BATCH_SIZE = Number(process.env.POLL_BATCH_SIZE) || 10;

const QUEUE_MAP: Record<string, Queue> = {
  "ai-jobs": aiJobsQueue,
  "video-jobs": videoJobsQueue,
  "media-jobs": mediaJobsQueue,
  "delivery-jobs": deliveryJobsQueue,
};

async function pollAndEnqueue(): Promise<void> {
  try {
    // Fetch pending jobs ordered by created_at
    const { data: pendingJobs, error } = await supabase
      .from("jobs")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (error) {
      console.error("[poller] Failed to fetch pending jobs:", error.message);
      return;
    }

    if (!pendingJobs || pendingJobs.length === 0) return;

    console.log(`[poller] Found ${pendingJobs.length} pending job(s)`);

    for (const job of pendingJobs) {
      // Atomic claim: only update if still pending (prevents double-pickup)
      const { data: claimed, error: claimError } = await supabase
        .from("jobs")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", job.id)
        .eq("status", "pending")
        .select()
        .single();

      if (claimError || !claimed) {
        // Another instance already claimed this job
        continue;
      }

      const queue = QUEUE_MAP[job.queue];
      if (!queue) {
        console.error(`[poller] Unknown queue "${job.queue}" for job ${job.id}`);
        await supabase
          .from("jobs")
          .update({
            status: "failed",
            error: `Unknown queue: ${job.queue}`,
            completed_at: new Date().toISOString(),
          })
          .eq("id", job.id);
        continue;
      }

      // Enqueue into BullMQ with the shape processors expect
      await queue.add(job.job_type, {
        skillName: job.job_type,
        showId: job.show_id,
        episodeId: job.episode_id,
        jobId: job.id,
        payload: job.payload || {},
      });

      console.log(
        `[poller] Enqueued job ${job.id} (${job.job_type}) → ${job.queue}`
      );
    }
  } catch (err) {
    console.error("[poller] Unexpected error:", err);
  }
}

let pollerInterval: ReturnType<typeof setInterval> | null = null;

export function startJobPoller(): void {
  if (pollerInterval) return;
  pollerInterval = setInterval(pollAndEnqueue, POLL_INTERVAL);
  console.log(
    `[poller] Job poller started. Polling every ${POLL_INTERVAL}ms, batch size ${BATCH_SIZE}.`
  );
  // Run once immediately
  pollAndEnqueue();
}

export function stopJobPoller(): void {
  if (pollerInterval) {
    clearInterval(pollerInterval);
    pollerInterval = null;
    console.log("[poller] Job poller stopped.");
  }
}
