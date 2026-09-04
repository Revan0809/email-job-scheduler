"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api, googleLoginUrl } from "@/lib/api";
import { Button } from "@/components/Button";
import { LogoMark } from "@/components/Logo";

const FEATURES = [
  {
    title: "Schedule at scale",
    body: "Batch-send thousands of emails from a CSV or pasted list, staggered exactly how you want.",
  },
  {
    title: "Built-in rate limiting",
    body: "Per-sender delays and hourly caps are enforced automatically — nothing ever fires all at once.",
  },
  {
    title: "Survives restarts",
    body: "Every job is durable. Kill the server mid-run and nothing is lost or sent twice.",
  },
];

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.87c2.27-2.09 3.58-5.17 3.58-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.94-2.9l-3.87-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.09A12 12 0 0 0 12 24Z"
      />
      <path fill="#FBBC05" d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58v-3.1H1.27a12 12 0 0 0 0 10.78l4-3.1Z" />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.61 4.58 1.8l3.44-3.44A11.94 11.94 0 0 0 12 0 12 12 0 0 0 1.27 6.61l4 3.1C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    api
      .me()
      .then(() => router.replace("/dashboard"))
      .catch(() => setChecking(false));
  }, [router]);

  if (checking) return null;

  return (
    <div className="w-full max-w-sm">
      <div className="mb-8 flex justify-center lg:hidden">
        <LogoMark className="h-14 w-14" />
      </div>

      <h1 className="text-center text-2xl font-semibold text-slate-900 lg:text-left">Welcome back</h1>
      <p className="mt-2 text-center text-sm text-slate-500 lg:text-left">
        Sign in to schedule and track your batch email sends.
      </p>

      {searchParams.get("error") && (
        <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">Login failed. Please try again.</p>
      )}

      <a href={googleLoginUrl()} className="mt-8 block">
        <Button className="w-full gap-3 !bg-white !text-slate-700 shadow-soft ring-1 ring-slate-200 hover:!bg-slate-50">
          <GoogleIcon />
          Continue with Google
        </Button>
      </a>

      <p className="mt-8 text-center text-xs text-slate-400 lg:text-left">
        By continuing you agree this is a demo project — emails are sent through a sandboxed test
        inbox, never real recipients.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden flex-col justify-between overflow-hidden bg-brand-gradient p-12 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />

        <div className="relative flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" aria-hidden="true">
              <path
                d="M3 7.5 12 13l9-5.5M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
                stroke="currentColor"
                strokeWidth={1.8}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">EmailScheduler</span>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-semibold leading-tight">
            Batch email delivery,
            <br />
            engineered properly.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-white/70">
            A scheduler built on durable queues, atomic rate limits, and zero cron jobs — designed
            to survive restarts and never double-send.
          </p>

          <ul className="mt-10 flex flex-col gap-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-3">
                <div className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                <div>
                  <div className="text-sm font-medium">{f.title}</div>
                  <div className="text-sm text-white/60">{f.body}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative text-xs text-white/50">Redis · Postgres · Elasticsearch · BullMQ</div>
      </div>

      <div className="flex items-center justify-center bg-slate-50 px-6 py-16">
        <Suspense fallback={null}>
          <LoginCard />
        </Suspense>
      </div>
    </main>
  );
}
