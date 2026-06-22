import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Edit } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PlanDeleteForm } from "@/components/plans/plan-delete-form";
import { PlanStatusForm } from "@/components/plans/plan-status-form";
import type { PlanStatus } from "@/lib/constants";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const STATUS_STYLES: Record<PlanStatus, string> = {
  DRAFT: "border-border text-muted-foreground",
  ACTIVE: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600",
  COMPLETED: "border-blue-500/40 bg-blue-500/10 text-blue-600",
  ARCHIVED: "border-border bg-surface-muted text-muted-foreground",
};

const STATUS_LABELS: Record<PlanStatus, string> = {
  DRAFT: "Draft",
  ACTIVE: "Active",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const plan = await prisma.plan.findUnique({
    where: { id },
    select: { name: true },
  });
  return { title: plan ? `${plan.name} — Health` : "Plan — Health" };
}

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { id } = await params;

  const plan = await prisma.plan.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      description: true,
      startDate: true,
      endDate: true,
      status: true,
      ownerId: true,
      schedule: {
        select: {
          dayOfWeek: true,
          workout: { select: { id: true, name: true } },
        },
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });

  if (!plan || plan.ownerId !== userId) notFound();

  const status = plan.status as PlanStatus;
  const scheduleByDay = new Map(plan.schedule.map((s) => [s.dayOfWeek, s.workout]));

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{plan.name}</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {formatDate(plan.startDate)} – {formatDate(plan.endDate)}
          </p>
        </div>
        <Link
          href={`/plans/${plan.id}/edit`}
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Edit className="h-4 w-4" />
          Edit
        </Link>
      </div>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full border px-2.5 py-0.5 text-sm font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.DRAFT}`}
          >
            {STATUS_LABELS[status] ?? plan.status}
          </span>
          <PlanStatusForm planId={plan.id} currentStatus={status} />
        </div>

        {plan.description ? (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <p className="text-sm text-foreground">{plan.description}</p>
          </div>
        ) : null}

        <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Weekly Schedule
          </p>
          <ul className="space-y-2">
            {DAYS.map((label, dayOfWeek) => {
              const workout = scheduleByDay.get(dayOfWeek);
              return (
                <li key={dayOfWeek} className="flex items-center gap-3 text-sm">
                  <span className="w-9 font-medium text-muted-foreground shrink-0">{label}</span>
                  {workout ? (
                    <Link
                      href={`/workouts/${workout.id}`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {workout.name}
                    </Link>
                  ) : (
                    <span className="text-muted-foreground">Rest</span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <PlanDeleteForm planId={plan.id} />
      </div>
    </div>
  );
}
