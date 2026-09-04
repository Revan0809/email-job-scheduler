import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { env } from "./config/env";
import passport from "./config/passport";
import { emailQueue } from "./queues/emailQueue";
import { ensureEmailIndex } from "./lib/elasticsearch";

import authRoutes from "./routes/auth";
import slackRoutes from "./routes/slack";
import emailRoutes from "./routes/emails";
import { requireAuth } from "./middleware/auth";

const app = express();

app.use(cors({ origin: env.frontendUrl, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(passport.initialize());

const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({
  // @bull-board/api's bundled types are built against an older bullmq
  // major version, so the Job type doesn't structurally match ours here
  // even though the runtime API is compatible - cast to unblock TS.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queues: [new BullMQAdapter(emailQueue as any) as any],
  serverAdapter,
});
// Gated behind the same login session as the dashboard - the queue
// dashboard exposes email content and internals, so it must not be public.
app.use("/admin/queues", requireAuth, serverAdapter.getRouter());

app.get("/health", (_req, res) => res.json({ ok: true }));

app.use("/auth", authRoutes);
app.use("/slack", slackRoutes);
app.use("/emails", emailRoutes);

async function main() {
  await ensureEmailIndex();
  app.listen(env.port, () => {
    console.log(`[server] Listening on http://localhost:${env.port}`);
    console.log(`[server] Bull Board: http://localhost:${env.port}/admin/queues`);
  });
}

main().catch((err) => {
  console.error("[server] Fatal error during startup", err);
  process.exit(1);
});
