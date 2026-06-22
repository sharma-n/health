"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export type AnalyticsTab = "overview" | "progression" | "records" | "volume" | "body";

const TABS: { id: AnalyticsTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "progression", label: "Progression" },
  { id: "records", label: "Records" },
  { id: "volume", label: "Volume" },
  { id: "body", label: "Body" },
];

export function AnalyticsTabNav({ activeTab }: { activeTab: AnalyticsTab }) {
  const searchParams = useSearchParams();

  function tabHref(tab: AnalyticsTab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    // Reset exercise selection when switching away from progression
    if (tab !== "progression") params.delete("exercise");
    // Reset metric selection when switching away from body
    if (tab !== "body") params.delete("metric");
    return `/analytics?${params.toString()}`;
  }

  return (
    <div className="flex gap-1 overflow-x-auto pb-1 mb-5 -mx-4 px-4 border-b border-border">
      {TABS.map((t) => (
        <Link
          key={t.id}
          href={tabHref(t.id)}
          className={`flex-shrink-0 px-3 py-2 text-sm font-medium rounded-t-md transition-colors border-b-2 -mb-px ${
            activeTab === t.id
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}
