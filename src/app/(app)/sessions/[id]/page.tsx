import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Clock, Zap, FileText, CheckCircle2, Circle } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { formatDateOnly } from "@/lib/dates";
import { SessionLogger } from "@/components/sessions/session-logger";
import { SessionDeleteForm } from "@/components/sessions/session-delete-form";
import type { MuscleGroup, UnitPreference } from "@/lib/constants";
import { fromKg, weightUnitLabel } from "@/lib/units";
import { BodyMap } from "@/components/ui/body-map";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const s = await prisma.session.findUnique({
    where: { id },
    select: { workout: { select: { name: true } } },
  });
  const name = s?.workout?.name ?? "Session";
  return { title: `${name} — Health` };
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDateTime(date: Date): string {
  return formatDateOnly(date, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export default async function SessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const { id } = await params;
  const unitPreference = (session.user.unitPreference ?? "KG") as UnitPreference;

  const sessionData = await prisma.session.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      workoutId: true,
      planId: true,
      scheduledDate: true,
      startedAt: true,
      endedAt: true,
      durationSeconds: true,
      overallEffort: true,
      notes: true,
      workout: {
        select: {
          name: true,
          exercises: {
            select: {
              exerciseId: true,
              targetSets: true,
              targetReps: true,
              targetWeightKg: true,
              restSeconds: true,
              notes: true,
              supersetGroup: true,
            },
            orderBy: { order: "asc" },
          },
        },
      },
      exercises: {
        select: {
          id: true,
          exerciseId: true,
          order: true,
          exercise: { select: { id: true, name: true, primaryMuscles: true } },
          sets: {
            select: {
              id: true,
              setNumber: true,
              weightKg: true,
              reps: true,
              completed: true,
              restSeconds: true,
              durationSeconds: true,
            },
            orderBy: { setNumber: "asc" },
          },
        },
        orderBy: { order: "asc" },
      },
    },
  });

  if (!sessionData || sessionData.userId !== userId) notFound();

  const isActive = !sessionData.endedAt;
  const unitLabel = weightUnitLabel(unitPreference);

  // Active session — load available exercises for ExercisePicker
  if (isActive) {
    const availableExercises = await prisma.exercise.findMany({
      where: {
        OR: [{ ownerId: userId }, { isSystem: true }],
        isArchived: false,
      },
      select: {
        id: true,
        name: true,
        equipment: true,
        primaryMuscles: true,
        secondaryMuscles: true,
        isSystem: true,
      },
      orderBy: { name: "asc" },
    });

    const workoutExercises = sessionData.workout?.exercises ?? [];
    const title = sessionData.workout?.name ?? "Ad-hoc session";

    return (
      <div>
        <PageHeader title={title} description="Active session — log your sets." />
        <SessionLogger
          session={{
            id: sessionData.id,
            startedAt: sessionData.startedAt,
            workoutId: sessionData.workoutId,
            exercises: sessionData.exercises,
          }}
          workoutExercises={workoutExercises}
          availableExercises={availableExercises}
          unitPreference={unitPreference}
        />
      </div>
    );
  }

  // Completed session — static summary view
  const title = sessionData.workout?.name ?? "Ad-hoc session";

  const muscleSets: Partial<Record<MuscleGroup, number>> = {};
  for (const ex of sessionData.exercises) {
    const completedCount = ex.sets.filter((s) => s.completed).length;
    if (completedCount === 0) continue;
    const muscles = Array.isArray(ex.exercise.primaryMuscles)
      ? (ex.exercise.primaryMuscles as MuscleGroup[])
      : [];
    for (const m of muscles) muscleSets[m] = (muscleSets[m] ?? 0) + completedCount;
  }

  return (
    <div>
      <PageHeader title={title} description={formatDateTime(sessionData.startedAt)} />

      <div className="space-y-4">
        {/* Summary stats */}
        <div className="grid grid-cols-2 gap-3">
          {sessionData.durationSeconds !== null && (
            <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Duration</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                {formatDuration(sessionData.durationSeconds)}
              </p>
            </div>
          )}
          {sessionData.overallEffort !== null && (
            <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs font-medium uppercase tracking-wide">Effort</span>
              </div>
              <p className="text-lg font-semibold text-foreground">
                RPE {sessionData.overallEffort}
                <span className="text-sm font-normal text-muted-foreground"> / 10</span>
              </p>
            </div>
          )}
        </div>

        {/* Muscle heatmap */}
        {Object.keys(muscleSets).length > 0 && (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <p className="mb-3 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Muscles worked
            </p>
            <BodyMap muscleIntensity={muscleSets} />
          </div>
        )}

        {/* Notes */}
        {sessionData.notes && (
          <div className="rounded-[var(--radius-app)] border border-border bg-surface p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <FileText className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">Notes</span>
            </div>
            <p className="text-sm text-foreground whitespace-pre-line">{sessionData.notes}</p>
          </div>
        )}

        {/* Exercise log */}
        {sessionData.exercises.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
              Exercises ({sessionData.exercises.length})
            </p>
            {sessionData.exercises.map((ex) => {
              const completedSets = ex.sets.filter((s) => s.completed);
              return (
                <div
                  key={ex.id}
                  className="rounded-[var(--radius-app)] border border-border bg-surface p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-foreground">{ex.exercise.name}</p>
                    <span className="text-xs text-muted-foreground">
                      {completedSets.length} / {ex.sets.length} sets
                    </span>
                  </div>

                  {ex.sets.length > 0 ? (
                    <div className="space-y-1.5">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1.5rem_1fr_1fr] gap-2 text-xs font-medium text-muted-foreground px-1">
                        <span>#</span>
                        <span>{unitLabel}</span>
                        <span>Reps</span>
                      </div>
                      {ex.sets.map((s) => (
                        <div
                          key={s.id}
                          className={`grid grid-cols-[1.5rem_1fr_1fr] gap-2 items-center rounded-md px-1 py-1.5 text-sm ${s.completed ? "text-foreground" : "text-muted-foreground/60"}`}
                        >
                          <span className="font-medium">{s.setNumber}</span>
                          <span>
                            {s.weightKg !== null
                              ? `${round2(fromKg(s.weightKg, unitPreference))} ${unitLabel}`
                              : "—"}
                          </span>
                          <span className="flex items-center gap-1.5">
                            {s.completed ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                            )}
                            {s.reps !== null ? s.reps : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">No sets logged.</p>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-surface/50 p-6 text-center">
            <p className="text-sm text-muted-foreground">No exercises logged in this session.</p>
          </div>
        )}

        <SessionDeleteForm sessionId={sessionData.id} />
      </div>
    </div>
  );
}
