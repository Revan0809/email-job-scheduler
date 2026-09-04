# Email Job Scheduler

A production-style batch email scheduler: schedule thousands of emails to go out at a future time,
spaced out per-sender, capped per hour, resilient to restarts, with a live queue dashboard, search,
Slack alerts on rate-limit, and Google login.

Monorepo:

```
/backend   Express API + BullMQ worker (TypeScript, Prisma, Redis, Elasticsearch)
/frontend  Next.js dashboard (TypeScript, Tailwind)
docker-compose.yml   Redis + Postgres + Elasticsearch
```

## 1. Prerequisites

- Node.js 20+
- Docker Desktop (for Redis / Postgres / Elasticsearch)

## 2. Start infrastructure

```bash
docker compose up -d
docker compose ps   # wait until all three show healthy
```

This starts:
- **Redis** on `localhost:6379` (BullMQ queue + rate-limit counters)
- **Postgres** on `localhost:5432` (db `email_scheduler`, user/pass `postgres`/`postgres`)
- **Elasticsearch** on `localhost:9200` (single-node, security disabled, dev only)

## 3. Backend setup

```bash
cd backend
cp .env.example .env
npm install
npx prisma migrate dev --name init
npm run dev        # starts the Express API on :4000
```

In a **second terminal**, start the worker (a separate process from the API, as it should be
in production — you can scale workers independently of the API):

```bash
cd backend
npm run worker
```

The first time either process boots, it will auto-generate an **Ethereal** test SMTP account
(no signup needed) and cache it to `backend/.ethereal-account.json` so subsequent restarts reuse the
same inbox. Watch the console log for a line like:

```
[mailer] Created Ethereal account: xxxx@ethereal.email
```

Every "sent" email is actually delivered to that Ethereal inbox — log in at
https://ethereal.email/login with the cached user/pass to see them, or check the preview URL
nodemailer prints for `sendMail`. Optionally pin the account by copying the generated
`user`/`pass` into `ETHEREAL_USER` / `ETHEREAL_PASS` in `.env`.

## 4. Frontend setup

```bash
cd frontend
cp .env.local.example .env.local
npm install
npm run dev         # starts Next.js on :3000
```

Visit http://localhost:3000.

## 5. Google OAuth (required for login)

1. Go to https://console.cloud.google.com/apis/credentials
2. Create an OAuth 2.0 Client ID (type: Web application)
3. Authorized redirect URI: `http://localhost:4000/auth/google/callback`
4. Put the Client ID / Secret into `backend/.env` as `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
5. Restart the backend API process

## 6. Slack OAuth (optional — for rate-limit alerts)

1. Go to https://api.slack.com/apps → Create New App → From scratch
2. Under **OAuth & Permissions**, add the `incoming-webhook` scope
3. Set the redirect URL to `http://localhost:4000/slack/oauth/callback`
4. Copy the Client ID / Secret into `backend/.env` as `SLACK_CLIENT_ID` / `SLACK_CLIENT_SECRET`
5. Restart the backend API, log into the dashboard, click **Connect Slack**

If a user never connects Slack, rate-limit notifications silently no-op — nothing breaks.
Connecting later starts notifications immediately without a server restart, since the webhook
URL is read fresh from Postgres on every rate-limit hit.

## 7. Bull Board (queue dashboard)

http://localhost:4000/admin/queues — live view of scheduled/active/delayed/completed/failed jobs.
Gated behind the same login session cookie as the dashboard (log into the app in the same browser
first), since it exposes email content and internals.

## 8. Load test (1000+ emails at once)

```bash
cd backend
npm run seed:load-test -- 1000
```

This creates a batch of 1000 emails all scheduled for "now" and enqueues 1000 BullMQ jobs for the
same sender. Watch http://localhost:4000/admin/queues — you'll see them sit in **waiting/delayed**
and drain gradually according to `WORKER_CONCURRENCY`, the per-sender minimum delay, and the
hourly limit, instead of firing all at once.

## 9. Restart-persistence demo

1. Schedule a batch with a start time ~2 minutes in the future.
2. Confirm the jobs appear as **delayed** in Bull Board.
3. Kill the worker process (Ctrl+C).
4. Restart it (`npm run worker`). On boot it logs a reconciliation pass:
   `[reconciliation] Checked N scheduled email(s), restored 0 missing job(s).`
   (0 restored because the delayed jobs were already safely persisted in Redis — nothing was lost.)
5. To simulate real drift, `docker compose restart redis` with `--no-deps` after removing the
   redis volume (or `redis-cli FLUSHALL`) while emails are still `scheduled` in Postgres, then
   restart the worker — it will detect the missing jobs and re-enqueue them from the DB rows.
6. The emails still send at (approximately) their original scheduled time, with no duplicates —
   job ids are deterministic (`email-<db id>`), so BullMQ silently no-ops a duplicate `add()`.

**Verified during development**: a DB row was created in `scheduled` status with its BullMQ job
deliberately omitted (simulating a crash between the DB write and the `queue.add()` call). On the
next worker boot, the log read `[reconciliation] Checked 1 scheduled email(s), restored 1 missing
job(s).`, the restored job fired at its scheduled time, and Postgres/Elasticsearch both show
exactly one send — no duplicates, no lost job. Separately, a 1000-email load test confirmed jobs
drain gradually under `WORKER_CONCURRENCY` + rate limits (not all at once), and that hitting the
hourly cap reschedules the remainder into the next hour window instead of dropping or failing them.

---

## Architecture

### Scheduling (no cron, anywhere)

- `POST /emails/schedule` writes one `EmailBatch` row and one `Email` row per recipient to
  Postgres (`status: scheduled`), staggering each recipient's `scheduledTime` by the requested
  per-email delay starting from `startTime`.
- For each `Email` row, a **BullMQ delayed job** is added to the `email-send` queue with
  `delay = scheduledTime - now` and a **deterministic job id**: `email-<email.id>`.
- The worker (`src/worker.ts`) processes jobs as their delay expires — no polling, no cron, purely
  event-driven via BullMQ/Redis.

### Restart-persistence & idempotency

- BullMQ delayed jobs live in Redis (sorted sets), independent of any Node process — they survive
  API/worker restarts on their own.
- On **worker boot**, `reconcileScheduledEmails()` (`src/services/reconciliation.ts`) fetches every
  DB row with `status: scheduled` and checks whether its BullMQ job still exists
  (`queue.getJob(jobId)`). Missing jobs (e.g. Redis was flushed, or the API crashed before the
  `queue.add()` call landed) are re-added with a freshly computed delay.
- Because job ids are deterministic (`email-<db id>`), re-adding a job that already exists is a
  **no-op** — BullMQ dedupes by job id — so reconciliation can safely run every boot without ever
  creating duplicate sends.

### Concurrency & rate limiting

- `WORKER_CONCURRENCY` (env var) sets how many jobs one worker process handles in parallel
  (`Worker` `concurrency` option).
- **Per-sender minimum delay**: the requested delay-between-emails is enforced two ways:
  1. A global floor via the BullMQ `Worker`'s `limiter: { max: 1, duration: SENDER_MIN_DELAY_MS }`
     option, as required. Note: OSS BullMQ's `limiter` throttles the whole worker process, not a
     dynamic key like "sender" (grouped/keyed rate limiting is a BullMQ **Pro** feature) — this is
     documented explicitly as a trade-off below.
  2. True **per-sender** spacing is additionally enforced inside the processor
     (`src/jobs/emailProcessor.ts`) via a Redis `SET key NX PX <delay>` reservation
     (`lastsend:<sender>`). If another job for the same sender sent too recently, the job is
     rescheduled with `job.moveToDelayed()` + `throw new DelayedError()` — BullMQ's supported
     pattern for "not ready yet, try again later" without marking the job failed.
- **Hourly limit per sender** (`MAX_EMAILS_PER_HOUR_PER_SENDER`, overridable per batch via the
  compose form): enforced with a Redis key `rate:<sender>:<hourBucket>` incremented atomically via
  a Lua script (`INCR` + conditional `EXPIRE`, with a rollback `DECR` if the increment pushed the
  counter over the limit) — safe under concurrent workers since the whole check-and-increment is a
  single atomic Redis operation. When the limit is hit, the job is **not failed or dropped** — it's
  rescheduled (`moveToDelayed` + `DelayedError`) to the start of the next hour window, with a small
  per-job stagger so relative order among that sender's jobs is preserved as much as possible.

### Slack notifications

- The moment a job hits the hourly limit, `notifySlackRateLimitHit()` looks up that user's
  `SlackIntegration` row and POSTs to their stored incoming-webhook URL.
- If no integration exists, it's a silent no-op (checked before any network call, wrapped in
  try/catch) — never throws, never blocks the send pipeline.
- Because the webhook URL is read from Postgres on every hit (not cached in memory), connecting
  Slack later starts working immediately with no server restart.

### Elasticsearch

- Every email is indexed both at schedule time (`status: scheduled`) and again when the worker
  finishes processing it (`status: sent | failed`), keyed by the email's DB id so the ES doc is
  updated in place rather than duplicated.
- `GET /emails/search?q=` runs a `multi_match` query across recipient/subject/body/sender.

### Bull Board

Mounted at `/admin/queues` via `@bull-board/express`, wired directly to the same `email-send`
BullMQ queue instance the API and worker use.

### Auth

- Google OAuth via `passport-google-oauth20` lives entirely in the backend. On success, the
  backend issues an httpOnly JWT cookie; the frontend never sees Google tokens directly.
- The frontend fetches `/auth/me` (`credentials: 'include'`) to render the logged-in user and
  gates the dashboard behind it.

## Feature checklist

- [x] Batch schedule API (subject/body/recipients/CSV/startTime/delay/hourlyLimit)
- [x] Postgres persistence with `scheduled | sent | failed` status
- [x] BullMQ delayed jobs, zero cron
- [x] Deterministic job ids → idempotent re-adds
- [x] Startup reconciliation (DB ↔ Redis drift repair)
- [x] `WORKER_CONCURRENCY` env var
- [x] Worker `limiter` option + Redis-backed per-sender min delay
- [x] Redis atomic hourly limit counter (Lua script), re-enqueue instead of drop/fail
- [x] Slack OAuth connect flow, silent no-op when disconnected, live once connected
- [x] Elasticsearch indexing on schedule + on send, `/emails/search`
- [x] Bull Board at `/admin/queues`
- [x] Google OAuth login, JWT session cookie, header shows name/email/avatar + logout
- [x] Next.js dashboard: tabs, compose modal (CSV + paste, client-side parsed count), tables with
      loading/empty states, toasts
- [x] 1000-job load test script

## Assumptions, shortcuts, trade-offs

- **"Sender" is the logged-in user's Google email**, not a separate configurable SMTP identity —
  all outbound mail actually goes through one shared Ethereal test account (Ethereal doesn't
  support arbitrary custom "from" addresses/domains for a free test inbox), but rate-limit buckets,
  the min-delay reservation, and Slack alerts are all keyed by the user's email, so the multi-sender
  logic is fully real and testable with multiple Google accounts.
- **Per-sender BullMQ `limiter` is process-global, not grouped by key** — see "Concurrency & rate
  limiting" above. This is a hard limitation of OSS BullMQ (grouped rate limiting is Pro-only), so
  the assignment's literal ask (limiter option on the Worker) is satisfied as a global floor, and
  true per-sender spacing is layered on top via a Redis reservation + `DelayedError` reschedule.
- **CSV parsing happens in the browser** (per the assignment) to show a live detected-recipient
  count before submit; the backend also accepts a raw CSV upload and parses it server-side as a
  defense-in-depth fallback, but the frontend always sends a resolved JSON array of recipients.
- **No Prisma migration is auto-run on boot** — you run `prisma migrate dev` once; this is standard
  practice (avoids surprise schema changes in a running process).
- **Job retry**: transient send failures retry up to 3 times with exponential backoff (BullMQ
  `attempts`/`backoff`) before the email is marked `failed` in Postgres/ES.
- **Elasticsearch runs with `xpack.security.enabled=false`** for local dev simplicity — not for
  production use as-is.
- **Slack OAuth + live notification fully verified end-to-end**: connected a real Slack workspace
  through the "Connect Slack" button, then deliberately forced a sender's hourly limit to be hit —
  a real message ("⚠️ Hourly send limit reached for ...") arrived in the Slack channel selected
  during install, posted live by the app, not a log line. The no-op-when-disconnected path was
  separately verified during the load test: a batch was run for a sender with no Slack integration
  connected and it completed without error or crash.
