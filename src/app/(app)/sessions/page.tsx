import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { SessionCard } from "@/components/sessions/session-card";

export const metadata: Metadata = { title: "Log — Health" };

export default async function SessionsPage() {
  const session = await auth();
  const userId = session?.user?.id;

  const sessions = userId
    ? await prisma.session.findMany({
        where: { userId },
        orderBy: { startedAt: "desc" },
        take: 50,
        select: {
          id: true,
          startedAt: true,
          endedAt: true,
          durationSeconds: true,
          overallEffort: true,
          workout: { select: { name: true } },
          _count: { select: { exercises: true } },
        },
      })
    : [];

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <PageHeader title="Sessions" />
        <Link
          href="/sessions/new"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-surface/50 p-8 text-center space-y-3">
          <p className="text-sm text-muted-foreground">No sessions logged yet.</p>
          <Link
            href="/sessions/new"
            className="inline-flex items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            Log your first session
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <SessionCard
              key={s.id}
              id={s.id}
              startedAt={s.startedAt}
              endedAt={s.endedAt}
              durationSeconds={s.durationSeconds}
              overallEffort={s.overallEffort}
              workoutName={s.workout?.name ?? null}
              exerciseCount={s._count.exercises}
            />
          ))}
        </div>
      )}
    </div>
  );
}
