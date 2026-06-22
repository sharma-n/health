import Link from "next/link";
import type { Metadata } from "next";
import { ClipboardList, Zap } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { startSessionAction } from "@/lib/actions/session";

export const metadata: Metadata = { title: "New Session — Health" };

export default async function NewSessionPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const workouts = userId
    ? await prisma.workout.findMany({
        where: { ownerId: userId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          name: true,
          description: true,
          _count: { select: { exercises: true } },
        },
      })
    : [];

  return (
    <div>
      <PageHeader
        title="New Session"
        description="Choose a workout template or start ad-hoc."
      />

      <div className="space-y-4">
        {/* Ad-hoc session */}
        <form action={startSessionAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-[var(--radius-app)] border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 active:bg-surface-muted"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-app)] bg-surface-muted text-primary">
              <Zap className="h-5 w-5" />
            </span>
            <div>
              <p className="font-medium text-foreground">Ad-hoc session</p>
              <p className="text-sm text-muted-foreground">Start empty, add exercises as you go</p>
            </div>
          </button>
        </form>

        {/* Workout templates */}
        {workouts.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground px-1">
              From Template
            </p>
            {workouts.map((w) => (
              <form key={w.id} action={startSessionAction}>
                <input type="hidden" name="workoutId" value={w.id} />
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-[var(--radius-app)] border border-border bg-surface p-4 text-left transition-colors hover:border-primary/40 active:bg-surface-muted"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius-app)] bg-surface-muted text-primary">
                    <ClipboardList className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{w.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {w._count.exercises} exercise{w._count.exercises !== 1 ? "s" : ""}
                      {w.description ? ` · ${w.description}` : ""}
                    </p>
                  </div>
                </button>
              </form>
            ))}
          </div>
        )}

        {workouts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            No workout templates yet — you can still start an ad-hoc session above or{" "}
            <Link href="/workouts/new" className="text-primary underline underline-offset-2">
              create a workout
            </Link>{" "}
            first.
          </p>
        )}
      </div>
    </div>
  );
}
