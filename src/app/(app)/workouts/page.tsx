import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { WorkoutList } from "@/components/workouts/workout-list";

export const metadata: Metadata = { title: "Workouts — Health" };

const WORKOUT_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  createdAt: true,
  _count: {
    select: { exercises: true },
  },
} as const;

export default async function WorkoutsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const workouts = await prisma.workout.findMany({
    where: { ownerId: userId },
    select: WORKOUT_LIST_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workouts</h1>
          <p className="text-sm text-muted-foreground">
            Reusable templates: ordered exercises with target sets and reps.
          </p>
        </div>
        <Link
          href="/workouts/new"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      <WorkoutList workouts={workouts} />
    </div>
  );
}
