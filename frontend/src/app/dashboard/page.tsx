"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import toast from "react-hot-toast";
import { api } from "@/lib/api";
import { EmailRecord, User } from "@/types";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { EmailsTable } from "@/components/EmailsTable";
import { ComposeModal } from "@/components/ComposeModal";
import { StatCard } from "@/components/StatCard";
import { CheckCircleIcon, ClockIcon, MailIcon, PlusIcon, XCircleIcon } from "@/components/icons";

type Tab = "scheduled" | "sent";

function SlackStatusToast() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const slackStatus = searchParams.get("slack");
    if (slackStatus === "connected") toast.success("Slack connected");
    if (slackStatus === "error") toast.error("Failed to connect Slack");
  }, [searchParams]);

  return null;
}

function DashboardContent() {
  const router = useRouter();

  const [user, setUser] = useState<User | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [tab, setTab] = useState<Tab>("scheduled");
  const [scheduled, setScheduled] = useState<EmailRecord[]>([]);
  const [sent, setSent] = useState<EmailRecord[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(true);
  const [composeOpen, setComposeOpen] = useState(false);

  useEffect(() => {
    api
      .me()
      .then(setUser)
      .catch(() => router.replace("/login"))
      .finally(() => setLoadingUser(false));
  }, [router]);

  const loadEmails = useCallback(async () => {
    setLoadingEmails(true);
    try {
      const [scheduledEmails, sentEmails] = await Promise.all([api.scheduledEmails(), api.sentEmails()]);
      setScheduled(scheduledEmails);
      setSent(sentEmails);
    } catch {
      toast.error("Failed to load emails");
    } finally {
      setLoadingEmails(false);
    }
  }, []);

  useEffect(() => {
    if (user) loadEmails();
  }, [user, loadEmails]);

  const stats = useMemo(() => {
    const sentCount = sent.filter((e) => e.status === "sent").length;
    const failedCount = sent.filter((e) => e.status === "failed").length;
    return {
      scheduled: scheduled.length,
      sent: sentCount,
      failed: failedCount,
      total: scheduled.length + sent.length,
    };
  }, [scheduled, sent]);

  if (loadingUser || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <Suspense fallback={null}>
        <SlackStatusToast />
      </Suspense>

      <Header user={user} onLoggedOut={() => router.replace("/login")} />

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Overview</h1>
            <p className="mt-1 text-sm text-slate-500">Track everything moving through your send queue.</p>
          </div>
          <Button onClick={() => setComposeOpen(true)} className="gap-1.5">
            <PlusIcon />
            Compose new email
          </Button>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Total emails" value={stats.total} icon={<MailIcon />} accent="brand" />
          <StatCard label="Scheduled" value={stats.scheduled} icon={<ClockIcon />} accent="amber" />
          <StatCard label="Sent" value={stats.sent} icon={<CheckCircleIcon />} accent="emerald" />
          <StatCard label="Failed" value={stats.failed} icon={<XCircleIcon />} accent="red" />
        </div>

        <div className="mb-4 flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          {(["scheduled", "sent"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t} emails
            </button>
          ))}
        </div>

        {tab === "scheduled" ? (
          <EmailsTable emails={scheduled} isLoading={loadingEmails} variant="scheduled" />
        ) : (
          <EmailsTable emails={sent} isLoading={loadingEmails} variant="sent" />
        )}
      </main>

      <ComposeModal isOpen={composeOpen} onClose={() => setComposeOpen(false)} onScheduled={loadEmails} />
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
