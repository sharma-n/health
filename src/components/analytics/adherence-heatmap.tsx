"use client";

import type { HeatmapDay } from "@/lib/analytics/adherence";

interface AdherenceHeatmapProps {
  data: HeatmapDay[]; // exactly 112 days (16 weeks)
}

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function cellColor(count: number): string {
  if (count === 0) return "bg-surface-muted";
  if (count === 1) return "bg-primary/30";
  if (count === 2) return "bg-primary/60";
  return "bg-primary";
}

export function AdherenceHeatmap({ data }: AdherenceHeatmapProps) {
  // data is ordered oldest→newest, 112 days
  // Find the day of week of the first entry to know column offset
  const firstDate = new Date(data[0].date + "T00:00:00Z");
  // We display Mon=0 … Sun=6
  const firstDayOfWeek = (firstDate.getUTCDay() + 6) % 7; // convert Sun=0 to Mon=0

  // Pad the start with empty cells so columns align to Monday
  const paddedData = [
    ...Array(firstDayOfWeek).fill(null),
    ...data,
  ];

  // Group into weeks of 7
  const weeks: (HeatmapDay | null)[][] = [];
  for (let i = 0; i < paddedData.length; i += 7) {
    weeks.push(paddedData.slice(i, i + 7));
  }

  // Find months for labels (show month label when it changes column to column)
  const monthLabels: (string | null)[] = weeks.map((week) => {
    const firstReal = week.find((d) => d !== null);
    if (!firstReal) return null;
    const d = new Date(firstReal.date + "T00:00:00Z");
    return d.getUTCDate() <= 7
      ? MONTH_NAMES[d.getUTCMonth()]
      : null;
  });

  const CELL = 14; // px
  const GAP = 3;   // px

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex gap-0">
        {/* Day labels column */}
        <div className="flex flex-col mr-1" style={{ gap: GAP }}>
          {/* Spacer for month row */}
          <div style={{ height: 14 }} />
          {DAY_LABELS.map((label, i) => (
            <div
              key={i}
              className="text-[9px] text-muted-foreground flex items-center justify-end pr-0.5"
              style={{ height: CELL }}
            >
              {i % 2 === 0 ? label : ""}
            </div>
          ))}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col" style={{ gap: GAP, marginRight: GAP }}>
            {/* Month label */}
            <div
              className="text-[9px] text-muted-foreground leading-none"
              style={{ height: 14, whiteSpace: "nowrap" }}
            >
              {monthLabels[wi] ?? ""}
            </div>
            {week.map((day, di) => (
              <div
                key={di}
                title={day ? `${day.date}: ${day.count} session${day.count !== 1 ? "s" : ""}` : ""}
                className={`rounded-sm ${day ? cellColor(day.count) : "bg-transparent"}`}
                style={{ width: CELL, height: CELL }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
