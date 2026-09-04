import { EmailStatus } from "@/types";

const STYLES: Record<EmailStatus, string> = {
  scheduled: "bg-amber-50 text-amber-700 ring-amber-200",
  sent: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
};

const DOT_STYLES: Record<EmailStatus, string> = {
  scheduled: "bg-amber-500",
  sent: "bg-emerald-500",
  failed: "bg-red-500",
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset ${STYLES[status]}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[status]}`} />
      {status}
    </span>
  );
}
