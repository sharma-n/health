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
import type { MuscleVolumeWeek } from "@/lib/analytics/volume";

interface VolumeChartProps {
  weeks: MuscleVolumeWeek[];
  muscleGroups: string[];
}

// Fixed palette — each muscle group gets a consistent colour
const MUSCLE_COLORS: Record<string, string> = {
  CHEST: "#3b82f6",
  BACK: "#10b981",
  SHOULDERS: "#8b5cf6",
  BICEPS: "#f59e0b",
  TRICEPS: "#ef4444",
  FOREARMS: "#f97316",
  QUADS: "#06b6d4",
  HAMSTRINGS: "#84cc16",
  GLUTES: "#ec4899",
  CALVES: "#14b8a6",
  ABS: "#a78bfa",
  OBLIQUES: "#fb7185",
  TRAPS: "#fbbf24",
  LATS: "#22d3ee",
  NECK: "#94a3b8",
  FULL_BODY: "#64748b",
};

function getColor(muscle: string, idx: number): string {
  return MUSCLE_COLORS[muscle] ?? `hsl(${(idx * 47) % 360}, 65%, 55%)`;
}

function formatLabel(mg: string): string {
  return mg.charAt(0) + mg.slice(1).toLowerCase().replace("_", " ");
}

export function VolumeChart({ weeks, muscleGroups }: VolumeChartProps) {
  if (weeks.length === 0 || muscleGroups.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No session data yet — log sessions to see muscle volume.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={weeks} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
        <XAxis
          dataKey="weekLabel"
          tick={{ fontSize: 10, fill: "var(--color-muted-foreground)" }}
          axisLine={false}
          tickLine={false}
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
            fontSize: 11,
          }}
          labelStyle={{ color: "var(--color-foreground)", fontWeight: 600, marginBottom: 4 }}
          formatter={(val, name) => [
            `${val as number} kg`,
            formatLabel(name as string),
          ]}
        />
        <Legend
          wrapperStyle={{ fontSize: 10 }}
          formatter={(value) => formatLabel(value)}
        />
        {muscleGroups.map((mg, i) => (
          <Bar
            key={mg}
            dataKey={mg}
            stackId="volume"
            fill={getColor(mg, i)}
            maxBarSize={40}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
