import Link from "next/link";
import type { Metadata } from "next";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PlanList } from "@/components/plans/plan-list";

export const metadata: Metadata = { title: "Plans — Health" };

const PLAN_LIST_SELECT = {
  id: true,
  name: true,
  description: true,
  startDate: true,
  endDate: true,
  status: true,
  _count: { select: { schedule: true } },
} as const;

export default async function PlansPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const plans = await prisma.plan.findMany({
    where: { ownerId: userId },
    select: PLAN_LIST_SELECT,
    orderBy: { createdAt: "desc" },
  });

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Plans</h1>
          <p className="text-sm text-muted-foreground">
            Schedule workouts across the week over a date range.
          </p>
        </div>
        <Link
          href="/plans/new"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-[var(--radius-app)] bg-primary px-3 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          New
        </Link>
      </div>

      <PlanList plans={plans} />
    </div>
  );
}
