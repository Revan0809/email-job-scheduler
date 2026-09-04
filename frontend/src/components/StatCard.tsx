import { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: number;
  icon: ReactNode;
  accent: "brand" | "amber" | "emerald" | "red";
}

const ACCENT_CLASSES: Record<StatCardProps["accent"], string> = {
  brand: "bg-brand-50 text-brand-600",
  amber: "bg-amber-50 text-amber-600",
  emerald: "bg-emerald-50 text-emerald-600",
  red: "bg-red-50 text-red-600",
};

export function StatCard({ label, value, icon, accent }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-soft">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${ACCENT_CLASSES[accent]}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums text-slate-900">{value.toLocaleString()}</div>
        <div className="truncate text-sm text-slate-500">{label}</div>
      </div>
    </div>
  );
}
