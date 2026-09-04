import { EmailRecord } from "@/types";
import { Table } from "./Table";
import { StatusBadge } from "./StatusBadge";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function RecipientCell({ recipient }: { recipient: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-medium uppercase text-slate-500">
        {recipient.charAt(0)}
      </div>
      <span className="truncate">{recipient}</span>
    </div>
  );
}

interface EmailsTableProps {
  emails: EmailRecord[];
  isLoading: boolean;
  variant: "scheduled" | "sent";
}

export function EmailsTable({ emails, isLoading, variant }: EmailsTableProps) {
  const timeColumn =
    variant === "scheduled"
      ? { key: "time", header: "Scheduled time", render: (row: EmailRecord) => formatDate(row.scheduledTime) }
      : { key: "time", header: "Sent time", render: (row: EmailRecord) => formatDate(row.sentTime) };

  return (
    <Table
      rows={emails}
      isLoading={isLoading}
      rowKey={(row) => row.id}
      emptyMessage={variant === "scheduled" ? "No scheduled emails yet" : "No sent emails yet"}
      emptyHint={
        variant === "scheduled"
          ? "Compose a new email and it'll show up here as soon as it's queued."
          : "Emails will appear here once they've been sent or failed."
      }
      columns={[
        { key: "recipient", header: "Recipient", render: (row) => <RecipientCell recipient={row.recipient} /> },
        { key: "subject", header: "Subject", render: (row) => row.subject },
        timeColumn,
        { key: "status", header: "Status", render: (row) => <StatusBadge status={row.status} /> },
      ]}
    />
  );
}
