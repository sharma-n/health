import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { PlanForm } from "@/components/plans/plan-form";
import { updatePlanAction } from "@/lib/actions/plan";
import type { PlanStatus } from "@/lib/constants";

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
  return { title: plan ? `Edit ${plan.name} — Health` : "Edit Plan — Health" };
}

export default async function EditPlanPage({
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
        select: { dayOfWeek: true, workoutId: true },
        orderBy: { dayOfWeek: "asc" },
      },
    },
  });

  if (!plan || plan.ownerId !== userId) notFound();

  const availableWorkouts = await prisma.workout.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { createdAt: "desc" },
  });

  const defaultValues = {
    planId: plan.id,
    name: plan.name,
    description: plan.description ?? undefined,
    startDate: plan.startDate.toISOString().slice(0, 10),
    endDate: plan.endDate.toISOString().slice(0, 10),
    status: plan.status as PlanStatus,
    schedule: plan.schedule,
  };

  return (
    <div>
      <PageHeader title={`Edit: ${plan.name}`} />
      <PlanForm
        action={updatePlanAction}
        availableWorkouts={availableWorkouts}
        defaultValues={defaultValues}
      />
    </div>
  );
}
