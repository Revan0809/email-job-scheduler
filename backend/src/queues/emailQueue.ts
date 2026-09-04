import { Queue } from "bullmq";
import { createRedisConnection } from "../lib/redis";

export const EMAIL_QUEUE_NAME = "email-send";

export interface EmailJobData {
  emailId: string;
  sender: string;
  requeueCount: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: { age: 24 * 3600, count: 5000 },
    removeOnFail: { age: 7 * 24 * 3600 },
  },
});

// Job ids are derived deterministically from the email row's DB id, so
// re-adding the same email is a no-op (BullMQ dedupes by job id) - this is
// our idempotency guarantee across restarts / reconciliation runs.
export function jobIdForEmail(emailId: string): string {
  return `email-${emailId}`;
}

export async function scheduleEmailJob(params: {
  emailId: string;
  sender: string;
  delayMs: number;
  requeueCount?: number;
}) {
  const { emailId, sender, delayMs, requeueCount = 0 } = params;
  return emailQueue.add(
    "send-email",
    { emailId, sender, requeueCount },
    {
      jobId: jobIdForEmail(emailId),
      delay: Math.max(0, delayMs),
    }
  );
}
