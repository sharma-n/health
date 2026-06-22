import type { Metadata } from "next";

import { auth } from "@/auth";
import { PageHeader } from "@/components/app-shell/page-header";
import { MetricLogForm } from "@/components/metrics/metric-log-form";
import { logBodyMetricAction } from "@/lib/actions/body-metric";

export const metadata: Metadata = { title: "Log Measurement — Health" };

export default async function NewMetricPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return (
    <div>
      <PageHeader title="Log Measurement" />
      <MetricLogForm action={logBodyMetricAction} unitPreference={session.user.unitPreference} />
    </div>
  );
}
