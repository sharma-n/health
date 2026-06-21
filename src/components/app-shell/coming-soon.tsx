import { Construction } from "lucide-react";

export function ComingSoon({ milestone }: { milestone: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[var(--radius-app)] border border-dashed border-border bg-surface px-6 py-12 text-center">
      <Construction className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="font-medium">Coming soon</p>
      <p className="mt-1 text-sm text-muted-foreground">
        This section ships in {milestone}.
      </p>
    </div>
  );
}
