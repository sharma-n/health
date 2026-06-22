import type { Metadata } from "next";
import { Suspense } from "react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { AnalyticsTabNav, type AnalyticsTab } from "@/components/analytics/tab-nav";
import { StatCard } from "@/components/analytics/stat-card";
import { AdherenceHeatmap } from "@/components/analytics/adherence-heatmap";
import { AdherenceBars } from "@/components/analytics/adherence-bars";
import { ProgressionChart } from "@/components/analytics/progression-chart";
import { VolumeChart } from "@/components/analytics/volume-chart";
import { MetricTrendChart } from "@/components/analytics/metric-trend-chart";
import { ExerciseSelector } from "@/components/analytics/exercise-selector";
import { MetricSelector } from "@/components/analytics/metric-selector";
import { getAdherenceStats } from "@/lib/analytics/adherence";
import { getPersonalRecords, PR_LABEL } from "@/lib/analytics/prs";
import { getExerciseProgression, getTrainedExercises } from "@/lib/analytics/progression";
import { getMuscleVolumeByWeek } from "@/lib/analytics/volume";
import { Trophy, TrendingUp } from "lucide-react";

export const metadata: Metadata = { title: "Analytics — Health" };

interface AnalyticsPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getParam(
  params: Record<string, string | string[] | undefined>,
  key: string,
): string | null {
  const v = params[key];
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return v[0] ?? null;
  return null;
}

export default async function AnalyticsPage({ searchParams }: AnalyticsPageProps) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const resolvedParams = await searchParams;
  const rawTab = getParam(resolvedParams, "tab");
  const VALID_TABS: AnalyticsTab[] = ["overview", "progression", "records", "volume", "body"];
  const activeTab: AnalyticsTab = VALID_TABS.includes(rawTab as AnalyticsTab)
    ? (rawTab as AnalyticsTab)
    : "overview";

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Progression, personal records, adherence and volume."
      />

      <Suspense fallback={null}>
        <AnalyticsTabNav activeTab={activeTab} />
      </Suspense>

      {activeTab === "overview" && <OverviewTab userId={userId} />}
      {activeTab === "progression" && (
        <ProgressionTab
          userId={userId}
          exerciseId={getParam(resolvedParams, "exercise")}
        />
      )}
      {activeTab === "records" && <RecordsTab userId={userId} />}
      {activeTab === "volume" && <VolumeTab userId={userId} />}
      {activeTab === "body" && (
        <BodyTab
          userId={userId}
          metricType={getParam(resolvedParams, "metric")}
        />
      )}
    </div>
  );
}

// ── Overview ─────────────────────────────────────────────────────────────────

async function OverviewTab({ userId }: { userId: string }) {
  const stats = await getAdherenceStats(userId, prisma);

  const weekChange =
    stats.sessionsLastWeek > 0
      ? stats.sessionsThisWeek - stats.sessionsLastWeek
      : null;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 gap-2">
        <StatCard
          label="Streak"
          value={`${stats.currentStreak}d`}
          sub={
            stats.longestStreak > stats.currentStreak
              ? `Best: ${stats.longestStreak}d`
              : "current best"
          }
          accent={stats.currentStreak >= 3 ? "emerald" : "default"}
        />
        <StatCard
          label="This week"
          value={stats.sessionsThisWeek}
          sub={
            weekChange !== null
              ? weekChange > 0
                ? `+${weekChange} vs last`
                : `${weekChange} vs last`
              : "sessions"
          }
          accent="blue"
        />
        <StatCard
          label="Total"
          value={stats.totalCompleted}
          sub="all time"
        />
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">Sessions per week</p>
        {stats.weeklyBars.length > 0 ? (
          <AdherenceBars data={stats.weeklyBars} />
        ) : (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Log your first session to see weekly activity.
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-semibold text-foreground mb-3">
          Activity — last 16 weeks
        </p>
        {stats.heatmapData.some((d) => d.count > 0) ? (
          <AdherenceHeatmap data={stats.heatmapData} />
        ) : (
          <div className="flex h-20 items-center justify-center text-sm text-muted-foreground">
            No sessions logged yet.
          </div>
        )}
        <div className="flex items-center gap-2 mt-2">
          <p className="text-[11px] text-muted-foreground">Less</p>
          {[0, 1, 2, 3].map((n) => (
            <div
              key={n}
              className={`h-3 w-3 rounded-sm ${
                n === 0
                  ? "bg-surface-muted"
                  : n === 1
                    ? "bg-primary/30"
                    : n === 2
                      ? "bg-primary/60"
                      : "bg-primary"
              }`}
            />
          ))}
          <p className="text-[11px] text-muted-foreground">More</p>
        </div>
      </div>
    </div>
  );
}

// ── Progression ───────────────────────────────────────────────────────────────

type ProgressionMetric = "estimatedOneRM" | "topWeightKg" | "totalVolumeKg";

async function ProgressionTab({
  userId,
  exerciseId,
}: {
  userId: string;
  exerciseId: string | null;
}) {
  const exercises = await getTrainedExercises(userId, prisma);

  const selectedId =
    exerciseId && exercises.find((e) => e.id === exerciseId)
      ? exerciseId
      : exercises[0]?.id ?? null;

  const data = selectedId
    ? await getExerciseProgression(userId, selectedId, prisma)
    : [];

  const METRIC_OPTIONS: { value: ProgressionMetric; label: string }[] = [
    { value: "estimatedOneRM", label: "Est. 1RM" },
    { value: "topWeightKg", label: "Top Weight" },
    { value: "totalVolumeKg", label: "Total Volume" },
  ];

  if (exercises.length === 0) {
    return (
      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-6 text-center">
        <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="font-medium text-foreground">No sessions logged yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Log at least one completed session to see your progression.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Exercise
        </p>
        <Suspense fallback={null}>
          <ExerciseSelector exercises={exercises} selectedId={selectedId} />
        </Suspense>
      </div>

      {METRIC_OPTIONS.map(({ value, label }) => (
        <div key={value}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-foreground">{label}</p>
            {data.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {data.length} session{data.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
            <ProgressionChart data={data} metric={value} />
          </div>
        </div>
      ))}

      {data.length > 0 && (
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Latest session
          </p>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-lg font-bold text-foreground">
                {data[data.length - 1].topWeightKg?.toFixed(1) ?? "—"}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Top weight</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {data[data.length - 1].estimatedOneRM?.toFixed(1) ?? "—"}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Est. 1RM</p>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">
                {data[data.length - 1].totalVolumeKg}
                <span className="text-xs font-normal text-muted-foreground ml-0.5">kg</span>
              </p>
              <p className="text-[11px] text-muted-foreground">Volume</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Records ───────────────────────────────────────────────────────────────────

async function RecordsTab({ userId }: { userId: string }) {
  const prs = await getPersonalRecords(userId, prisma);

  if (prs.length === 0) {
    return (
      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-6 text-center">
        <Trophy className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
        <p className="font-medium text-foreground">No records yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Log at least 2 sessions with the same exercise to start tracking PRs.
        </p>
      </div>
    );
  }

  const byExercise = new Map<string, typeof prs>();
  for (const pr of prs) {
    if (!byExercise.has(pr.exerciseId)) byExercise.set(pr.exerciseId, []);
    byExercise.get(pr.exerciseId)!.push(pr);
  }

  return (
    <div className="space-y-4">
      {prs.some((p) => p.isNew) && (
        <div className="rounded-[var(--radius-app)] border border-amber-300/60 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700/40 p-3">
          <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">
            ✨ You set new PRs in the last 14 days
          </p>
        </div>
      )}

      {[...byExercise.entries()].map(([, exercisePRs]) => {
        const name = exercisePRs[0].exerciseName;
        return (
          <div
            key={exercisePRs[0].exerciseId}
            className="rounded-[var(--radius-app)] border border-border bg-surface p-4"
          >
            <p className="font-semibold text-foreground mb-3">{name}</p>
            <div className="grid grid-cols-3 gap-2">
              {exercisePRs.map((pr) => (
                <div key={pr.prType} className="text-center">
                  <div className="relative inline-block">
                    <p className="text-lg font-bold text-foreground">
                      {pr.value % 1 === 0 ? pr.value : pr.value.toFixed(1)}
                      <span className="text-xs font-normal text-muted-foreground ml-0.5">
                        {pr.unit}
                      </span>
                    </p>
                    {pr.isNew && (
                      <span className="absolute -top-2 -right-3 text-[9px] font-bold text-amber-600 dark:text-amber-400">
                        NEW
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {PR_LABEL[pr.prType]}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(pr.achievedAt + "T00:00:00Z").toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Volume ────────────────────────────────────────────────────────────────────

async function VolumeTab({ userId }: { userId: string }) {
  const { weeks, muscleGroups } = await getMuscleVolumeByWeek(userId, prisma, 8);

  const hasData = weeks.some((w) =>
    muscleGroups.some((mg) => (w[mg] as number) > 0),
  );

  const totals: Record<string, number> = {};
  for (const w of weeks) {
    for (const mg of muscleGroups) {
      totals[mg] = (totals[mg] ?? 0) + ((w[mg] as number) ?? 0);
    }
  }
  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const top3 = sorted
    .slice(0, 3)
    .map(([mg]) => mg.charAt(0) + mg.slice(1).toLowerCase());

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold text-foreground mb-1">
          Volume by muscle group
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Total load (kg) distributed across primary muscles, last 8 weeks.
        </p>
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
          <VolumeChart weeks={weeks} muscleGroups={muscleGroups} />
        </div>
      </div>

      {hasData && top3.length > 0 && (
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Most trained
          </p>
          <p className="text-sm text-foreground">{top3.join(", ")}</p>
          {sorted.length > 3 && (
            <p className="text-xs text-muted-foreground mt-1">
              {sorted
                .slice(3)
                .map(([mg]) => mg.charAt(0) + mg.slice(1).toLowerCase())
                .join(", ")}{" "}
              — less volume recently
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Body ──────────────────────────────────────────────────────────────────────

async function BodyTab({
  userId,
  metricType,
}: {
  userId: string;
  metricType: string | null;
}) {
  const logged = await prisma.bodyMetric.findMany({
    where: { userId },
    select: { type: true },
    distinct: ["type"],
    orderBy: { type: "asc" },
  });
  const availableMetrics = logged.map((m) => m.type);

  const selectedType =
    availableMetrics.includes(metricType ?? "")
      ? metricType!
      : availableMetrics[0] ?? null;

  if (availableMetrics.length === 0) {
    return (
      <div className="rounded-[var(--radius-app)] border border-border bg-surface p-6 text-center">
        <p className="font-medium text-foreground">No body metrics logged yet</p>
        <p className="text-sm text-muted-foreground mt-1">
          Log your bodyweight or measurements to see trends here.
        </p>
      </div>
    );
  }

  const metricData =
    selectedType != null
      ? await prisma.bodyMetric.findMany({
          where: { userId, type: selectedType },
          select: { date: true, value: true },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
        })
      : [];

  const relatedGoal =
    selectedType != null
      ? await prisma.goal.findFirst({
          where: { userId, type: "BODY_METRIC", status: "ACTIVE" },
          select: { config: true },
        })
      : null;

  let goalTarget: number | null = null;
  if (relatedGoal) {
    const config = relatedGoal.config as {
      metricType?: string;
      targetValue?: number;
    };
    if (config.metricType === selectedType && config.targetValue != null) {
      goalTarget = config.targetValue;
    }
  }

  const unit =
    selectedType === "BODY_FAT_PCT"
      ? "%"
      : selectedType === "BODYWEIGHT"
        ? "kg"
        : "cm";

  const chartData = metricData.map((m) => ({
    date: new Date(m.date).toISOString().slice(0, 10),
    value: m.value,
  }));

  const latest = metricData[metricData.length - 1];
  const earliest = metricData[0];
  const change =
    latest && earliest && metricData.length > 1
      ? latest.value - earliest.value
      : null;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
          Metric
        </p>
        <Suspense fallback={null}>
          <MetricSelector
            selectedMetric={selectedType}
            availableMetrics={availableMetrics}
          />
        </Suspense>
      </div>

      {selectedType && (
        <>
          {latest && (
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label="Current"
                value={latest.value.toFixed(1)}
                sub={unit}
                accent="blue"
              />
              <StatCard
                label="Change"
                value={
                  change != null
                    ? `${change > 0 ? "+" : ""}${change.toFixed(1)}`
                    : "—"
                }
                sub={change != null ? unit : "not enough data"}
                accent={
                  change == null ? "default" : change < 0 ? "emerald" : "amber"
                }
              />
              <StatCard label="Entries" value={metricData.length} sub="logged" />
            </div>
          )}

          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-3">
            <MetricTrendChart
              data={chartData}
              unit={unit}
              goalTarget={goalTarget}
            />
          </div>

          {goalTarget != null && (
            <p className="text-xs text-muted-foreground text-center">
              — — Goal target: {goalTarget} {unit}
            </p>
          )}
        </>
      )}
    </div>
  );
}
