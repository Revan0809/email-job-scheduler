import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { parse } from "csv-parse/sync";
import { prisma } from "../lib/prisma";
import { requireAuth, AuthedRequest } from "../middleware/auth";
import { scheduleBatch } from "../services/schedulingService";
import { searchEmails } from "../lib/elasticsearch";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const scheduleSchema = z.object({
  subject: z.string().min(1),
  body: z.string().min(1),
  startTime: z.coerce.date(),
  delayMs: z.coerce.number().int().min(0).default(2000),
  hourlyLimit: z.coerce.number().int().min(1).default(100),
  recipients: z.array(z.string()).optional(),
});

function extractEmailsFromCsv(buffer: Buffer): string[] {
  const records: string[][] = parse(buffer, { skip_empty_lines: true, relax_column_count: true });
  const emails = new Set<string>();
  for (const row of records) {
    for (const cell of row) {
      const value = cell.trim();
      if (EMAIL_REGEX.test(value)) emails.add(value);
    }
  }
  return Array.from(emails);
}

router.post("/schedule", requireAuth, upload.single("csv"), async (req: AuthedRequest, res) => {
  try {
    const rawRecipients = req.body.recipients
      ? typeof req.body.recipients === "string"
        ? JSON.parse(req.body.recipients)
        : req.body.recipients
      : undefined;

    const parsed = scheduleSchema.parse({ ...req.body, recipients: rawRecipients });

    let recipients = parsed.recipients ?? [];
    if (req.file) {
      recipients = [...recipients, ...extractEmailsFromCsv(req.file.buffer)];
    }
    recipients = Array.from(new Set(recipients.map((r) => r.trim()).filter(Boolean)));
    recipients = recipients.filter((r) => EMAIL_REGEX.test(r));

    if (recipients.length === 0) {
      return res.status(400).json({ error: "No valid recipient emails provided" });
    }

    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) return res.status(404).json({ error: "User not found" });

    const { batch, emails } = await scheduleBatch({
      userId: user.id,
      sender: user.email,
      subject: parsed.subject,
      body: parsed.body,
      recipients,
      startTime: parsed.startTime,
      delayMs: parsed.delayMs,
      hourlyLimit: parsed.hourlyLimit,
    });

    res.status(201).json({ batch, emailCount: emails.length });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: "Invalid request", details: err.errors });
    }
    console.error("[emails] schedule error", err);
    res.status(500).json({ error: "Failed to schedule emails" });
  }
});

router.get("/scheduled", requireAuth, async (req: AuthedRequest, res) => {
  const emails = await prisma.email.findMany({
    where: { userId: req.userId, status: "scheduled" },
    orderBy: { scheduledTime: "asc" },
  });
  res.json(emails);
});

router.get("/sent", requireAuth, async (req: AuthedRequest, res) => {
  const emails = await prisma.email.findMany({
    where: { userId: req.userId, status: { in: ["sent", "failed"] } },
    orderBy: [{ sentTime: "desc" }, { updatedAt: "desc" }],
  });
  res.json(emails);
});

router.get("/search", requireAuth, async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  if (!q.trim()) return res.json([]);
  try {
    const results = await searchEmails(q);
    res.json(results);
  } catch (err) {
    console.error("[emails] search error", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;
