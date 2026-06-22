"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

export interface MetricDataPoint {
  date: string; // "YYYY-MM-DD"
  value: number;
}

interface MetricTrendChartProps {
  data: MetricDataPoint[];
  unit: string;
  goalTarget?: number | null;
}

export function MetricTrendChart({ data, unit, goalTarget }: MetricTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No data logged yet.
      </div>
    );
  }

  const formatted = data.map((d) => {
    const dt = new Date(d.date + "T00:00:00Z");
    return {
      ...d,
      label: dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    };
  });

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
          domain={["auto", "auto"]}
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-app)",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
          formatter={(val) => [`${(val as number).toFixed(1)} ${unit}`, "Value"]}
        />
        {goalTarget != null && (
          <ReferenceLine
            y={goalTarget}
            stroke="#f59e0b"
            strokeDasharray="4 3"
            label={{
              value: `Goal: ${goalTarget} ${unit}`,
              position: "insideTopRight",
              fontSize: 10,
              fill: "#f59e0b",
            }}
          />
        )}
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-primary)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-primary)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
