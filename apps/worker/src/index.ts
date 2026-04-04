import { Worker } from "bullmq";
import { connection } from "./lib/redis";
import { startJobPoller, stopJobPoller } from "./lib/job-poller";

console.log("Starting GodModeProd worker...");

const aiWorker = new Worker(
  "ai-jobs",
  async (job) => {
    console.log(`[ai-jobs] Processing ${job.name} (${job.id})`);
    const { processAiJob } = await import("./processors/ai");
    return processAiJob(job);
  },
  { connection, concurrency: 3 }
);

const videoWorker = new Worker(
  "video-jobs",
  async (job) => {
    console.log(`[video-jobs] Processing ${job.name} (${job.id})`);
    const { processVideoJob } = await import("./processors/video");
    return processVideoJob(job);
  },
  { connection, concurrency: 2 }
);

const mediaWorker = new Worker(
  "media-jobs",
  async (job) => {
    console.log(`[media-jobs] Processing ${job.name} (${job.id})`);
    const { processMediaJob } = await import("./processors/media");
    return processMediaJob(job);
  },
  { connection, concurrency: 2 }
);

const deliveryWorker = new Worker(
  "delivery-jobs",
  async (job) => {
    console.log(`[delivery-jobs] Processing ${job.name} (${job.id})`);
    const { processDeliveryJob } = await import("./processors/delivery");
    return processDeliveryJob(job);
  },
  { connection, concurrency: 5 }
);

const workers = [aiWorker, videoWorker, mediaWorker, deliveryWorker];

for (const worker of workers) {
  worker.on("completed", (job) => {
    console.log(`[${worker.name}] Completed ${job.name} (${job.id})`);
  });
  worker.on("failed", (job, err) => {
    console.error(
      `[${worker.name}] Failed ${job?.name} (${job?.id}):`,
      err.message
    );
  });
}

async function shutdown() {
  console.log("Shutting down workers...");
  stopJobPoller();
  await Promise.all(workers.map((w) => w.close()));
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

startJobPoller();

console.log("Worker ready. Listening for jobs on 4 queues.");
