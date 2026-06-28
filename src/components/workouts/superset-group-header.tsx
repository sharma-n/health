"use client";

import { Link2Off } from "lucide-react";
import { getSupersetColor } from "@/lib/superset-color";

type SupersetGroupHeaderProps = {
  groupName: string;
  restSeconds: number | null;
  onRestChange: (seconds: number | null) => void;
  onDisband: () => void;
};

export function SupersetGroupHeader({
  groupName,
  restSeconds,
  onRestChange,
  onDisband,
}: SupersetGroupHeaderProps) {
  const color = getSupersetColor(groupName);

  return (
    <div
      className={`flex items-center gap-3 rounded-t-md border-l-4 px-3 py-2 ${color.border} ${color.bg}`}
    >
      <span className="flex-1 text-sm font-semibold text-foreground">
        Superset {groupName}
      </span>
      <div className="flex items-center gap-1.5">
        <label className="whitespace-nowrap text-xs font-medium text-muted-foreground">
          Rest between rounds (s)
        </label>
        <input
          type="number"
          min="0"
          value={restSeconds?.toString() ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onRestChange(val === "" ? null : parseInt(val, 10) || null);
          }}
          placeholder="—"
          className="h-8 w-16 rounded-md border border-border bg-surface px-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
        />
      </div>
      <button
        type="button"
        onClick={onDisband}
        title="Disband superset — removes grouping from all exercises"
        className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-danger"
      >
        <Link2Off className="h-4 w-4" />
        Disband
      </button>
    </div>
  );
}
