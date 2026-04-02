import type { Job } from "bullmq";
import { logActivity, updateJobStatus } from "../lib/supabase";
import { sendMessage, sendDocument, sendVideo, sendPhoto } from "../lib/telegram";

export async function processDeliveryJob(job: Job): Promise<unknown> {
  const { showId, episodeId, jobId, deliveryType, chatId, content, filePath, caption } = job.data;

  if (jobId) await updateJobStatus(jobId, "running");
  await logActivity(showId, episodeId, `delivery:${deliveryType}:started`, {
    jobId: job.id,
  });

  try {
    switch (deliveryType) {
      case "message":
        await sendMessage({ chatId, text: content });
        break;
      case "document":
        await sendDocument({ chatId, filePath, caption });
        break;
      case "video":
        await sendVideo({ chatId, filePath, caption });
        break;
      case "photo":
        await sendPhoto({ chatId, filePath, caption });
        break;
      default:
        throw new Error(`Unknown delivery type: ${deliveryType}`);
    }

    if (jobId) await updateJobStatus(jobId, "completed");
    await logActivity(showId, episodeId, `delivery:${deliveryType}:completed`, {
      jobId: job.id,
    });

    return { delivered: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (jobId) await updateJobStatus(jobId, "failed", undefined, message);
    await logActivity(showId, episodeId, `delivery:${deliveryType}:failed`, {
      jobId: job.id,
      error: message,
    });
    throw error;
  }
}
