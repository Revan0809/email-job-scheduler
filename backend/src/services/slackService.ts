import axios from "axios";
import { prisma } from "../lib/prisma";

// Silently no-ops if the user has never connected Slack. Never throws -
// a missing/invalid integration must not affect email sending.
export async function notifySlackRateLimitHit(userId: string, sender: string, hourBucket: number) {
  try {
    const integration = await prisma.slackIntegration.findUnique({ where: { userId } });
    if (!integration?.webhookUrl) return;

    await axios.post(integration.webhookUrl, {
      text: `:warning: Hourly send limit reached for *${sender}*. Remaining emails for this batch will resume in the next hour window.`,
    });
  } catch (err) {
    console.error("[slack] Failed to send rate-limit notification", err);
  }
}
