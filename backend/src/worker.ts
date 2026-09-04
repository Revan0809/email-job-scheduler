import { Worker } from "bullmq";
import { env } from "./config/env";
import { createRedisConnection } from "./lib/redis";
import { EMAIL_QUEUE_NAME } from "./queues/emailQueue";
import { processEmailJob } from "./jobs/emailProcessor";
import { reconcileScheduledEmails } from "./services/reconciliation";
import { ensureEmailIndex } from "./lib/elasticsearch";

async function main() {
  await ensureEmailIndex();
  await reconcileScheduledEmails();

  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.workerConcurrency,
    // Global floor on send throughput for this worker process. True
    // per-sender spacing is additionally enforced inside the processor
    // (see rateLimiter.tryReserveSenderSlot) since BullMQ's OSS limiter
    // cannot be scoped to a dynamic key like "sender" - only Pro supports
    // grouped rate limiting. Documented in README.
    limiter: {
      max: 1,
      duration: env.senderMinDelayMs,
    },
  });

  worker.on("completed", (job) => {
    console.log(`[worker] Sent email job ${job.id}`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[worker] Job ${job?.id} failed: ${err.message}`);
  });

  console.log(
    `[worker] Started with concurrency=${env.workerConcurrency}, senderMinDelayMs=${env.senderMinDelayMs}`
  );

  process.on("SIGTERM", async () => {
    await worker.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error("[worker] Fatal error during startup", err);
  process.exit(1);
});
