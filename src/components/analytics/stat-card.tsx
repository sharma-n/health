interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "default" | "emerald" | "amber" | "blue";
}

const accentClasses: Record<string, string> = {
  default: "text-foreground",
  emerald: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  blue: "text-primary",
};

export function StatCard({ label, value, sub, accent = "default" }: StatCardProps) {
  return (
    <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3 flex flex-col gap-0.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground leading-none">
        {label}
      </p>
      <p className={`text-2xl font-bold leading-tight ${accentClasses[accent]}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[11px] text-muted-foreground leading-tight">{sub}</p>
      )}
    </div>
  );
}
