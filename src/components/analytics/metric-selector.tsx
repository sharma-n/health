"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { BODY_METRIC_TYPES } from "@/lib/constants";

interface MetricSelectorProps {
  selectedMetric: string | null;
  availableMetrics: string[];
}

function formatMetricLabel(type: string): string {
  const labels: Record<string, string> = {
    BODYWEIGHT: "Bodyweight",
    WAIST: "Waist",
    HIPS: "Hips",
    CHEST: "Chest",
    ARM_LEFT: "Left Arm",
    ARM_RIGHT: "Right Arm",
    THIGH_LEFT: "Left Thigh",
    THIGH_RIGHT: "Right Thigh",
    CALF: "Calf",
    NECK: "Neck",
    BODY_FAT_PCT: "Body Fat %",
  };
  return labels[type] ?? type;
}

export function MetricSelector({ selectedMetric, availableMetrics }: MetricSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("metric", e.target.value);
    router.push(`/analytics?${params.toString()}`);
  }

  return (
    <select
      value={selectedMetric ?? ""}
      onChange={onChange}
      className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <option value="" disabled>
        Select a metric…
      </option>
      {availableMetrics.map((m) => (
        <option key={m} value={m}>
          {formatMetricLabel(m)}
        </option>
      ))}
    </select>
  );
}
