import { DelayedError, Job } from "bullmq";
import { prisma } from "../lib/prisma";
import { getTransporter } from "../lib/mailer";
import { indexEmail } from "../lib/elasticsearch";
import { tryConsumeHourlySlot, tryReserveSenderSlot } from "../lib/rateLimiter";
import { notifySlackRateLimitHit } from "../services/slackService";
import { EmailJobData } from "../queues/emailQueue";

const MIN_DELAY_RETRY_BUFFER_MS = 250;
const REQUEUE_STAGGER_MS = 50;

export async function processEmailJob(job: Job<EmailJobData>, token?: string) {
  const { emailId, sender } = job.data;

  const email = await prisma.email.findUnique({ where: { id: emailId }, include: { batch: true } });
  if (!email) {
    console.warn(`[worker] Email ${emailId} no longer exists, skipping job ${job.id}`);
    return;
  }

  if (email.status !== "scheduled") {
    // Already handled (e.g. reconciliation ran twice) - nothing to do.
    return;
  }

  // 1. Minimum per-sender spacing (best-effort "rate limiter" between sends).
  // Checked before the hourly gate so a min-delay reschedule doesn't burn
  // an hourly slot for an email that hasn't actually sent yet.
  const slot = await tryReserveSenderSlot(sender, email.batch.delayMs);
  if (!slot.allowed) {
    await job.moveToDelayed(Date.now() + slot.retryAfterMs + MIN_DELAY_RETRY_BUFFER_MS, token);
    throw new DelayedError();
  }

  // 2. Hourly limit gate (Redis-backed, atomic, safe across worker processes).
  const hourly = await tryConsumeHourlySlot(sender, email.batch.hourlyLimit);
  if (!hourly.allowed) {
    const requeueCount = (job.data.requeueCount ?? 0) + 1;
    const delay = hourly.nextWindowStartMs - Date.now() + requeueCount * REQUEUE_STAGGER_MS;

    await job.updateData({ ...job.data, requeueCount });
    await job.moveToDelayed(Date.now() + delay, token);

    await notifySlackRateLimitHit(email.userId, sender, hourly.hourBucket);

    throw new DelayedError();
  }

  // 3. Actually send via Ethereal SMTP.
  try {
    const transporter = await getTransporter();
    await transporter.sendMail({
      from: sender,
      to: email.recipient,
      subject: email.subject,
      html: email.body,
    });

    const sentTime = new Date();
    await prisma.email.update({
      where: { id: email.id },
      data: { status: "sent", sentTime, errorMessage: null },
    });

    await indexEmail({
      emailId: email.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: "sent",
      sender,
      scheduledTime: email.scheduledTime.toISOString(),
      sentTime: sentTime.toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Only mark permanently failed once BullMQ has exhausted retries.
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (isFinalAttempt) {
      await prisma.email.update({
        where: { id: email.id },
        data: { status: "failed", errorMessage: message },
      });
      await indexEmail({
        emailId: email.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        status: "failed",
        sender,
        scheduledTime: email.scheduledTime.toISOString(),
        sentTime: null,
      });
    }

    throw err;
  }
}
