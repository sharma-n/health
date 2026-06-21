import Link from "next/link";
import type { Metadata } from "next";
import {
  Dumbbell,
  ClipboardList,
  CalendarDays,
  PlusCircle,
  Ruler,
  Target,
  LineChart,
  type LucideIcon,
} from "lucide-react";
import { auth } from "@/auth";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "Home — Health" };

type Shortcut = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const SHORTCUTS: Shortcut[] = [
  {
    href: "/sessions",
    label: "Start a session",
    description: "Log today's workout",
    icon: PlusCircle,
  },
  {
    href: "/plans",
    label: "Plans",
    description: "Your weekly routines",
    icon: CalendarDays,
  },
  {
    href: "/workouts",
    label: "Workouts",
    description: "Reusable templates",
    icon: ClipboardList,
  },
  {
    href: "/exercises",
    label: "Exercises",
    description: "Your movement library",
    icon: Dumbbell,
  },
  {
    href: "/goals",
    label: "Goals",
    description: "What you're working toward",
    icon: Target,
  },
  {
    href: "/metrics",
    label: "Body metrics",
    description: "Weight & measurements",
    icon: Ruler,
  },
  {
    href: "/analytics",
    label: "Analytics",
    description: "Progress & PRs",
    icon: LineChart,
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const firstName = (session?.user?.name ?? "Athlete").split(" ")[0];

  return (
    <div>
      <PageHeader
        title={`Hi, ${firstName}`}
        description="Your training home. Build the app one milestone at a time."
      />

      <div className="grid grid-cols-2 gap-3">
        {SHORTCUTS.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-[var(--radius-app)] border border-border bg-surface p-4 transition-colors hover:border-primary/50"
            >
              <span className="mb-3 flex h-9 w-9 items-center justify-center rounded-[var(--radius-app)] bg-surface-muted text-primary">
                <Icon className="h-5 w-5" />
              </span>
              <p className="font-medium leading-tight">{s.label}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {s.description}
              </p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
