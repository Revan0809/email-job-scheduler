/**
 * Enqueues N fake scheduled emails for the same sender, all targeting "now",
 * so you can watch them drain through the queue in the Bull Board UI
 * (http://localhost:4000/admin/queues) according to worker concurrency,
 * the per-sender min delay, and the hourly limit - instead of firing all at
 * once. Run with: npm run seed:load-test -- [count]
 */
import { prisma } from "../lib/prisma";
import { scheduleBatch } from "../services/schedulingService";

async function main() {
  const count = parseInt(process.argv[2] ?? "1000", 10);

  const user = await prisma.user.upsert({
    where: { googleId: "load-test-user" },
    update: {},
    create: {
      googleId: "load-test-user",
      email: "load-test@example.com",
      name: "Load Test User",
    },
  });

  const recipients = Array.from({ length: count }, (_, i) => `recipient${i}@example.com`);

  console.log(`Scheduling ${count} emails for ${user.email}, all starting now...`);

  const { batch } = await scheduleBatch({
    userId: user.id,
    sender: user.email,
    subject: "Load test email",
    body: "This is a load test.",
    recipients,
    startTime: new Date(),
    delayMs: 500,
    hourlyLimit: 100,
  });

  console.log(`Created batch ${batch.id} with ${count} emails.`);
  console.log("Watch it drain at http://localhost:4000/admin/queues");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
