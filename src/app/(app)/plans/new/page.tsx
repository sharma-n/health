import type { Metadata } from "next";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { PlanForm } from "@/components/plans/plan-form";
import { createPlanAction } from "@/lib/actions/plan";

export const metadata: Metadata = { title: "New Plan — Health" };

export default async function NewPlanPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const availableWorkouts = await prisma.workout.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <PageHeader title="New Plan" description="Set up a weekly training routine." />
      <PlanForm action={createPlanAction} availableWorkouts={availableWorkouts} />
    </div>
  );
}
