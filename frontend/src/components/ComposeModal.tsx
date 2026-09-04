"use client";

import { FormEvent, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Modal } from "./Modal";
import { Input, Textarea } from "./Input";
import { Button } from "./Button";
import { api } from "@/lib/api";

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduled: () => void;
}

const EMAIL_REGEX = /[^\s,;<>]+@[^\s,;<>]+\.[^\s,;<>]+/g;

function toLocalDateTimeInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

export function ComposeModal({ isOpen, onClose, onScheduled }: ComposeModalProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [recipientsText, setRecipientsText] = useState("");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [csvEmails, setCsvEmails] = useState<string[]>([]);
  const [startTime, setStartTime] = useState(() => toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60_000)));
  const [delaySeconds, setDelaySeconds] = useState(2);
  const [hourlyLimit, setHourlyLimit] = useState(100);
  const [submitting, setSubmitting] = useState(false);

  const pastedEmails = useMemo(() => Array.from(new Set(recipientsText.match(EMAIL_REGEX) ?? [])), [recipientsText]);
  const allRecipients = useMemo(
    () => Array.from(new Set([...pastedEmails, ...csvEmails])),
    [pastedEmails, csvEmails]
  );

  const handleFile = async (file: File | null) => {
    setCsvFile(file);
    if (!file) {
      setCsvEmails([]);
      return;
    }
    const text = await file.text();
    setCsvEmails(Array.from(new Set(text.match(EMAIL_REGEX) ?? [])));
  };

  const reset = () => {
    setSubject("");
    setBody("");
    setRecipientsText("");
    setCsvFile(null);
    setCsvEmails([]);
    setStartTime(toLocalDateTimeInputValue(new Date(Date.now() + 5 * 60_000)));
    setDelaySeconds(2);
    setHourlyLimit(100);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (allRecipients.length === 0) {
      toast.error("Add at least one recipient email");
      return;
    }

    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("subject", subject);
      formData.append("body", body);
      formData.append("recipients", JSON.stringify(allRecipients));
      formData.append("startTime", new Date(startTime).toISOString());
      formData.append("delayMs", String(delaySeconds * 1000));
      formData.append("hourlyLimit", String(hourlyLimit));

      const res = await api.scheduleBatch(formData);
      toast.success(`Scheduled ${res.emailCount} email(s)`);
      reset();
      onScheduled();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to schedule emails");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Compose new email">
      <form id="compose-form" onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Input label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} required />
        <Textarea
          label="Body"
          rows={5}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          required
        />

        <Textarea
          label="Recipients (paste emails, comma or newline separated)"
          rows={3}
          placeholder="alice@example.com, bob@example.com"
          value={recipientsText}
          onChange={(e) => setRecipientsText(e.target.value)}
        />

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Or upload a CSV</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
            className="text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-brand-700 hover:file:bg-brand-100"
          />
          {csvFile && <span className="text-xs text-slate-500">{csvFile.name}</span>}
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700 ring-1 ring-inset ring-brand-100">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600 text-[11px] font-semibold text-white">
            {allRecipients.length}
          </span>
          recipient{allRecipients.length === 1 ? "" : "s"} detected
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start time"
            type="datetime-local"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            required
          />
          <Input
            label="Delay between emails (seconds)"
            type="number"
            min={0}
            value={delaySeconds}
            onChange={(e) => setDelaySeconds(Number(e.target.value))}
            required
          />
        </div>

        <Input
          label="Hourly limit per sender"
          type="number"
          min={1}
          value={hourlyLimit}
          onChange={(e) => setHourlyLimit(Number(e.target.value))}
          required
        />
      </form>

      <div className="mt-2 flex justify-end gap-2">
        <Button variant="secondary" type="button" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit" form="compose-form" isLoading={submitting}>
          Schedule
        </Button>
      </div>
    </Modal>
  );
}
