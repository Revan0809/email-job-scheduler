import { InboxIllustration } from "./icons";

interface Column<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  key: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyMessage?: string;
  emptyHint?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyMessage = "No records found.",
  emptyHint,
}: TableProps<T>) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-soft">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50/80">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {isLoading &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5">
                      <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                    </td>
                  ))}
                </tr>
              ))}

            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16">
                  <div className="flex flex-col items-center justify-center gap-3 text-center">
                    <InboxIllustration className="h-16 w-16 text-slate-300" />
                    <div className="text-sm font-medium text-slate-600">{emptyMessage}</div>
                    {emptyHint && <div className="max-w-xs text-xs text-slate-400">{emptyHint}</div>}
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              rows.map((row) => (
                <tr key={rowKey(row)} className="transition-colors hover:bg-slate-50">
                  {columns.map((col) => (
                    <td key={col.key} className="px-4 py-3.5 text-slate-700">
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
