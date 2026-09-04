import { prisma } from "../lib/prisma";
import { scheduleEmailJob } from "../queues/emailQueue";
import { indexEmail } from "../lib/elasticsearch";

export interface ScheduleBatchInput {
  userId: string;
  sender: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayMs: number;
  hourlyLimit: number;
}

export async function scheduleBatch(input: ScheduleBatchInput) {
  const { userId, sender, subject, body, recipients, startTime, delayMs, hourlyLimit } = input;

  const batch = await prisma.$transaction(async (tx) => {
    const createdBatch = await tx.emailBatch.create({
      data: {
        userId,
        subject,
        body,
        startTime,
        delayMs,
        hourlyLimit,
        totalCount: recipients.length,
      },
    });

    await tx.email.createMany({
      data: recipients.map((recipient, index) => ({
        batchId: createdBatch.id,
        userId,
        recipient,
        subject,
        body,
        sender,
        scheduledTime: new Date(startTime.getTime() + index * delayMs),
      })),
    });

    return createdBatch;
  });

  const emails = await prisma.email.findMany({ where: { batchId: batch.id } });

  for (const email of emails) {
    const delay = email.scheduledTime.getTime() - Date.now();
    await scheduleEmailJob({ emailId: email.id, sender, delayMs: delay });
    await indexEmail({
      emailId: email.id,
      recipient: email.recipient,
      subject: email.subject,
      body: email.body,
      status: "scheduled",
      sender,
      scheduledTime: email.scheduledTime.toISOString(),
      sentTime: null,
    });
  }

  return { batch, emails };
}
