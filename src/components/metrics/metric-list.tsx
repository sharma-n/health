"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteBodyMetricAction, BodyMetricFormState } from "@/lib/actions/body-metric";
import { BODY_METRIC_TYPES, UnitPreference } from "@/lib/constants";
import { fromKg, fromCm, weightUnitLabel, lengthUnitLabel } from "@/lib/units";

interface Metric {
  id: string;
  type: string;
  date: Date;
  value: number;
  note: string | null;
}

interface Props {
  metrics: Metric[];
  unitPreference: UnitPreference;
}

function formatDisplayValue(metric: Metric, unitPreference: UnitPreference): { value: string; unit: string } {
  if (metric.type === "BODY_FAT_PCT") {
    return { value: metric.value.toFixed(1), unit: "%" };
  }
  if (metric.type === "BODYWEIGHT") {
    const converted = fromKg(metric.value, unitPreference);
    return { value: converted.toFixed(1), unit: weightUnitLabel(unitPreference) };
  }
  // All other types are lengths
  const converted = fromCm(metric.value, unitPreference);
  return { value: converted.toFixed(1), unit: lengthUnitLabel(unitPreference) };
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function groupByType(metrics: Metric[]): Record<string, Metric[]> {
  const grouped: Record<string, Metric[]> = {};
  for (const metric of metrics) {
    if (!grouped[metric.type]) {
      grouped[metric.type] = [];
    }
    grouped[metric.type].push(metric);
  }
  return grouped;
}

export function MetricList({ metrics, unitPreference }: Props) {
  const grouped = groupByType(metrics);
  const sortedTypes = Object.keys(grouped).sort();

  return (
    <div className="space-y-6">
      {sortedTypes.map((type) => (
        <div key={type}>
          <h3 className="text-sm font-semibold text-foreground mb-3">{type.replace(/_/g, " ")}</h3>
          <div className="space-y-2">
            {grouped[type].map((metric) => (
              <MetricRow key={metric.id} metric={metric} unitPreference={unitPreference} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function MetricRow({ metric, unitPreference }: { metric: Metric; unitPreference: UnitPreference }) {
  const [state, action] = useActionState(deleteBodyMetricAction, {} as BodyMetricFormState);
  const { value, unit } = formatDisplayValue(metric, unitPreference);
  const displayDate = formatDate(metric.date);

  return (
    <div className="flex items-start justify-between gap-4 rounded-[var(--radius-app)] border border-border bg-surface p-4">
      <div className="flex-1 space-y-1">
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold text-foreground">{value}</span>
          <span className="text-sm text-muted-foreground">{unit}</span>
        </div>
        <div className="text-xs text-muted-foreground">{displayDate}</div>
        {metric.note && <p className="text-sm text-muted-foreground mt-2">{metric.note}</p>}
      </div>
      <form action={action} className="flex-shrink-0">
        <input type="hidden" name="metricId" value={metric.id} />
        <button
          type="submit"
          className="p-2 rounded-[var(--radius-app)] hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="Delete measurement"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
