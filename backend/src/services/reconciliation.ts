import { prisma } from "../lib/prisma";
import { emailQueue, jobIdForEmail, scheduleEmailJob } from "../queues/emailQueue";
import { indexEmail } from "../lib/elasticsearch";

// Runs once when the worker boots. BullMQ jobs already in Redis survive a
// restart on their own - this only repairs drift, i.e. a DB row marked
// "scheduled" whose BullMQ job is missing (Redis was flushed / job expired
// / a previous process crashed before enqueueing it). Because job ids are
// deterministic (`email-<id>`), re-adding an email whose job already
// exists is a safe no-op - BullMQ will not create a duplicate.
export async function reconcileScheduledEmails() {
  const scheduledEmails = await prisma.email.findMany({
    where: { status: "scheduled" },
  });

  let restored = 0;
  for (const email of scheduledEmails) {
    const existingJob = await emailQueue.getJob(jobIdForEmail(email.id));
    if (existingJob) continue;

    const delayMs = email.scheduledTime.getTime() - Date.now();
    await scheduleEmailJob({ emailId: email.id, sender: email.sender, delayMs });
    await indexEmail({
      emailId: email.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: "scheduled",
      sender: email.sender,
      scheduledTime: email.scheduledTime.toISOString(),
      sentTime: null,
    });
    restored++;
  }

  console.log(
    `[reconciliation] Checked ${scheduledEmails.length} scheduled email(s), restored ${restored} missing job(s).`
  );
}
