import Link from "next/link";
import type { Metadata } from "next";
import {
  Dumbbell,
  ClipboardList,
  CalendarDays,
  PlusCircle,
  Ruler,
  Target,
  Play,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { startSessionAction } from "@/lib/actions/session";
import { GoalCard } from "@/components/goals/goal-card";
import { computeGoalProgress } from "@/lib/analytics/goals";
import { getDashboardStats } from "@/lib/analytics/dashboard";
import { StatCard } from "@/components/analytics/stat-card";
import { RecentPRs } from "@/components/analytics/recent-prs";
import { formatDateOnly, todayInTz, dayOfWeekInTz } from "@/lib/dates";

export const metadata: Metadata = { title: "Home — Health" };

type Shortcut = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const SHORTCUTS: Shortcut[] = [
  {
    href: "/plans",
    label: "Plans",
    description: "Your weekly routines",
    icon: CalendarDays,
  },
  {
    href: "/workouts",
    label: "Workouts",
    description: "Reusable templates",
    icon: ClipboardList,
  },
  {
    href: "/exercises",
    label: "Exercises",
    description: "Your movement library",
    icon: Dumbbell,
  },
  {
    href: "/goals",
    label: "Goals",
    description: "What you're working toward",
    icon: Target,
  },
  {
    href: "/metrics",
    label: "Body metrics",
    description: "Weight & measurements",
    icon: Ruler,
  },
];

function greetingDescription(
  streak: number,
  sessionsThisWeek: number,
  totalCompleted: number,
  firstName: string,
): string {
  if (totalCompleted === 0) return "Start your first session to begin your streak.";
  if (streak === 0 && sessionsThisWeek === 0) return "Rest day — come back strong.";
  if (streak >= 7) return `${streak}-day streak — you're on a roll, ${firstName}.`;
  if (streak > 0) return `${streak}-day streak — keep it going.`;
  if (sessionsThisWeek >= 3) return `${sessionsThisWeek} sessions this week — solid work.`;
  return "Keep showing up — consistency compounds.";
}

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const firstName = (session?.user?.name ?? "Athlete").split(" ")[0];

  const tz = session?.user?.timezone ?? "UTC";
  const todayStr = todayInTz(tz);                          // "YYYY-MM-DD" in user's tz
  const today = new Date(todayStr + "T00:00:00Z");         // UTC midnight of user's today
  const dayOfWeek = dayOfWeekInTz(tz);                     // 0=Sun … 6=Sat in user's tz

  const [todayOccurrence, stats] = await Promise.all([
    userId
      ? prisma.planScheduleItem.findFirst({
          where: {
            plan: {
              ownerId: userId,
              status: "ACTIVE",
              startDate: { lte: today },
              endDate: { gte: today },
            },
            dayOfWeek,
          },
          select: {
            workout: { select: { id: true, name: true } },
            plan: { select: { id: true, name: true } },
          },
        })
      : null,
    userId ? getDashboardStats(userId, prisma, tz) : null,
  ]);

  const description = stats
    ? greetingDescription(
        stats.currentStreak,
        stats.sessionsThisWeek,
        stats.totalCompleted,
        firstName,
      )
    : "Your training home.";

  return (
    <div>
      <PageHeader title={`Hi, ${firstName}`} description={description} />

      {/* Stats row */}
      {stats && (
        <div className="grid grid-cols-3 gap-2 mb-5">
          <StatCard
            label="Streak"
            value={`${stats.currentStreak}d`}
            sub={stats.currentStreak > 0 ? "in a row" : "start today"}
            accent={stats.currentStreak >= 3 ? "emerald" : "default"}
          />
          <StatCard
            label="This week"
            value={stats.sessionsThisWeek}
            sub={
              stats.sessionsLastWeek > 0
                ? `${stats.sessionsLastWeek} last wk`
                : "sessions"
            }
            accent="blue"
          />
          <StatCard
            label="All time"
            value={stats.totalCompleted}
            sub="completed"
          />
        </div>
      )}

      {/* Today's workout */}
      {todayOccurrence && (
        <div className="mb-5 rounded-[var(--radius-app)] border border-emerald-500/40 bg-emerald-500/10 p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Today&rsquo;s Workout
              </p>
              <p className="mt-0.5 font-medium text-foreground">
                {todayOccurrence.workout.name}
              </p>
              <p className="text-xs text-muted-foreground">{todayOccurrence.plan.name}</p>
            </div>
            <CalendarDays className="h-5 w-5 text-emerald-600 shrink-0" />
          </div>
          <form action={startSessionAction}>
            <input type="hidden" name="workoutId" value={todayOccurrence.workout.id} />
            <input type="hidden" name="planId" value={todayOccurrence.plan.id} />
            <input type="hidden" name="scheduledDate" value={today.toISOString()} />
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-md bg-emerald-600 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              <Play className="h-4 w-4" />
              Start Session
            </button>
          </form>
        </div>
      )}

      {/* Recent PRs */}
      {stats && stats.recentPRs.length > 0 && (
        <RecentPRs prs={stats.recentPRs} />
      )}

      {/* Goals + weight */}
      {userId && <DashboardGoalsAndWeight userId={userId} />}

      {/* Quick links */}
      <div className="mt-5">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">Quick access</p>
          <Link
            href="/sessions"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <PlusCircle className="h-3.5 w-3.5" /> Start session
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {SHORTCUTS.map((s) => {
            const Icon = s.icon;
            return (
              <Link
                key={s.href}
                href={s.href}
                className="group rounded-[var(--radius-app)] border border-border bg-surface p-4 transition-colors hover:border-primary/50"
              >
                <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--radius-app)] bg-surface-muted text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <p className="font-medium leading-tight">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

async function DashboardGoalsAndWeight({ userId }: { userId: string }) {
  const [activeGoals, latestWeight] = await Promise.all([
    prisma.goal.findMany({
      where: { userId, status: "ACTIVE" },
      take: 3,
      orderBy: { createdAt: "desc" },
    }),
    prisma.bodyMetric.findFirst({
      where: { userId, type: "BODYWEIGHT" },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: { value: true, date: true },
    }),
  ]);

  const goalsWithProgress = await Promise.all(
    activeGoals.map(async (goal) => {
      const progress = await computeGoalProgress(goal, prisma);
      return { ...goal, progress };
    }),
  );

  if (goalsWithProgress.length === 0 && !latestWeight) return null;

  return (
    <div className="mb-4 space-y-4">
      {latestWeight && (
        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Current Weight
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-foreground">
              {latestWeight.value.toFixed(1)}
            </span>
            <span className="text-sm text-muted-foreground">kg</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDateOnly(latestWeight.date)}
          </p>
        </div>
      )}

      {goalsWithProgress.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Active Goals</p>
            <Link
              href="/goals"
              className="text-xs text-primary hover:underline flex items-center gap-1"
            >
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {goalsWithProgress.map((goal) => (
              <GoalCard key={goal.id} goal={goal} progress={goal.progress} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
