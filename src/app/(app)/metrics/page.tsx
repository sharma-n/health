import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";

import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/app-shell/page-header";
import { MetricList } from "@/components/metrics/metric-list";

export const metadata: Metadata = { title: "Body metrics — Health" };

export default async function MetricsPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const metrics = await prisma.bodyMetric.findMany({
    where: { userId },
    orderBy: { date: "desc" },
    select: {
      id: true,
      type: true,
      date: true,
      value: true,
      note: true,
    },
  });

  return (
    <div>
      <PageHeader
        title="Body metrics"
        description="Log bodyweight and measurements over time."
        action={
          <Link
            href="/metrics/new"
            className="flex h-11 items-center gap-2 rounded-[var(--radius-app)] bg-primary px-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            <Plus className="h-5 w-5" />
            Log Measurement
          </Link>
        }
      />

      {metrics.length === 0 ? (
        <div className="rounded-[var(--radius-app)] border-2 border-dashed border-border bg-muted/20 p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No measurements logged yet.{" "}
            <Link href="/metrics/new" className="font-medium text-primary hover:underline">
              Log your first measurement
            </Link>
          </p>
        </div>
      ) : (
        <MetricList metrics={metrics} unitPreference={session.user.unitPreference} />
      )}
    </div>
  );
}
