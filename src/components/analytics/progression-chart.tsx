"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ProgressionPoint } from "@/lib/analytics/progression";

type Metric = "estimatedOneRM" | "topWeightKg" | "totalVolumeKg";

interface ProgressionChartProps {
  data: ProgressionPoint[];
  metric: Metric;
}

const METRIC_LABELS: Record<Metric, string> = {
  estimatedOneRM: "Est. 1RM (kg)",
  topWeightKg: "Top Weight (kg)",
  totalVolumeKg: "Total Volume (kg)",
};

function formatValue(val: number | null | undefined): string {
  if (val == null) return "—";
  return val % 1 === 0 ? String(val) : val.toFixed(1);
}

export function ProgressionChart({ data, metric }: ProgressionChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data yet — log a session to see your progression.
      </div>
    );
  }

  // Format x-axis date labels
  const formatted = data.map((d) => {
    const dt = new Date(d.date + "T00:00:00Z");
    return {
      ...d,
      label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });

  const domain = ["auto", "auto"] as [string | number, string | number];

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={formatted} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          domain={domain}
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          tickFormatter={formatValue}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-app)",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
          formatter={(val) => [formatValue(val as number | null | undefined), METRIC_LABELS[metric]]}
        />
        <Line
          type="monotone"
          dataKey={metric}
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-primary)" }}
          activeDot={{ r: 5 }}
          connectNulls={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
