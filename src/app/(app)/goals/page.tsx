import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { GoalCard } from "@/components/goals/goal-card";
import { computeGoalProgress } from "@/lib/analytics/goals";

export const metadata: Metadata = { title: "Goals — Health" };

export default async function GoalsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const goals = await prisma.goal.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  // Compute progress for each goal
  const goalsWithProgress = await Promise.all(
    goals.map(async (goal) => {
      const progress = await computeGoalProgress(goal, prisma);
      return { ...goal, progress };
    }),
  );

  return (
    <div>
      <PageHeader
        title="Goals"
        description="Strength, body-metric and consistency goals, tracked automatically."
        action={
          <Link
            href="/goals/new"
            className="flex h-11 items-center gap-2 rounded-[var(--radius-app)] bg-primary px-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            New Goal
          </Link>
        }
      />

      {goals.length === 0 ? (
        <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No goals yet.{" "}
            <Link href="/goals/new" className="font-medium text-primary hover:underline">
              Create your first goal
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {goalsWithProgress.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={goal.progress}
            />
          ))}
        </div>
      )}
    </div>
  );
}
