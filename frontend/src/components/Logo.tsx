export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-xl bg-brand-gradient shadow-soft ${className}`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-1/2 w-1/2 text-white" aria-hidden="true">
        <path
          d="M3 7.5 12 13l9-5.5M4.5 5h15A1.5 1.5 0 0 1 21 6.5v11A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11A1.5 1.5 0 0 1 4.5 5Z"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

export function Logo({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <LogoMark />
      <span className="text-lg font-semibold tracking-tight text-slate-900">
        Email<span className="text-brand-600">Scheduler</span>
      </span>
    </div>
  );
}
