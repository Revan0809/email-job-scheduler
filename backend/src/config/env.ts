import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "4000", 10),
  nodeEnv: process.env.NODE_ENV ?? "development",
  frontendUrl: required("FRONTEND_URL", "http://localhost:3000"),
  backendUrl: required("BACKEND_URL", "http://localhost:4000"),

  databaseUrl: required("DATABASE_URL"),
  redisUrl: required("REDIS_URL", "redis://localhost:6379"),

  elasticsearchUrl: required("ELASTICSEARCH_URL", "http://localhost:9200"),
  elasticsearchEmailIndex: process.env.ELASTICSEARCH_EMAIL_INDEX ?? "emails",

  jwtSecret: required("JWT_SECRET"),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "email_scheduler_session",

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    callbackUrl: process.env.GOOGLE_CALLBACK_URL ?? "http://localhost:4000/auth/google/callback",
  },

  slack: {
    clientId: process.env.SLACK_CLIENT_ID ?? "",
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? "",
    redirectUri: process.env.SLACK_REDIRECT_URI ?? "http://localhost:4000/slack/oauth/callback",
  },

  ethereal: {
    user: process.env.ETHEREAL_USER ?? "",
    pass: process.env.ETHEREAL_PASS ?? "",
  },

  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY ?? "5", 10),
  senderMinDelayMs: parseInt(process.env.SENDER_MIN_DELAY_MS ?? "2000", 10),
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER ?? "100", 10),
};
