"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { WeeklyBar } from "@/lib/analytics/adherence";

interface AdherenceBarsProps {
  data: WeeklyBar[];
}

export function AdherenceBars({ data }: AdherenceBarsProps) {
  const hasScheduled = data.some((d) => d.scheduled !== null);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          interval={1}
        />
        <YAxis
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
            borderRadius: "var(--radius-app)",
            fontSize: 12,
          }}
          labelStyle={{ color: "var(--color-foreground)", fontWeight: 600 }}
          itemStyle={{ color: "var(--color-muted-foreground)" }}
        />
        {hasScheduled && (
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            formatter={(value) =>
              value === "scheduled" ? "Scheduled" : "Completed"
            }
          />
        )}
        {hasScheduled && (
          <Bar
            dataKey="scheduled"
            fill="var(--color-border)"
            radius={[3, 3, 0, 0]}
            maxBarSize={24}
          />
        )}
        <Bar
          dataKey="completed"
          fill="var(--color-primary)"
          radius={[3, 3, 0, 0]}
          maxBarSize={24}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
