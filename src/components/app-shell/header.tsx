import Link from "next/link";
import { Dumbbell, LogOut } from "lucide-react";
import { signOutAction } from "@/lib/actions/auth";

export function AppHeader({ displayName }: { displayName: string }) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/dashboard" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-app)] bg-primary text-primary-foreground">
            <Dumbbell className="h-4 w-4" />
          </span>
          <span className="font-semibold tracking-tight">Health</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName}
          </span>
          <form action={signOutAction}>
            <button
              type="submit"
              aria-label="Sign out"
              className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-app)] border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
