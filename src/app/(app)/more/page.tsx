import Link from "next/link";
import type { Metadata } from "next";
import {
  Dumbbell,
  ClipboardList,
  Ruler,
  Target,
  User,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/app-shell/page-header";

export const metadata: Metadata = { title: "More — Health" };

const LINKS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/exercises", label: "Exercises", icon: Dumbbell },
  { href: "/workouts", label: "Workouts", icon: ClipboardList },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/metrics", label: "Body metrics", icon: Ruler },
  { href: "/profile", label: "Profile & settings", icon: User },
];

export default function MorePage() {
  return (
    <div>
      <PageHeader title="More" />
      <ul className="divide-y divide-border overflow-hidden rounded-[var(--radius-app)] border border-border bg-surface">
        {LINKS.map(({ href, label, icon: Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-surface-muted"
            >
              <Icon className="h-5 w-5 text-muted-foreground" />
              <span className="flex-1 font-medium">{label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
