"use client";

import { useEffect, useRef, useState } from "react";
import { SkipForward } from "lucide-react";

type RestTimerProps = {
  totalSeconds: number;
  onComplete: (actualSeconds: number) => void;
  onSkip: (actualSeconds: number) => void;
};

// Remount this component (via key prop on parent) to restart with new duration.
export function RestTimer({ totalSeconds, onComplete, onSkip }: RestTimerProps) {
  const [remaining, setRemaining] = useState(totalSeconds);
  const startedAtRef = useRef<number | null>(null);

  useEffect(() => {
    // Record start time on first tick (avoids calling Date.now in render).
    if (startedAtRef.current === null) {
      startedAtRef.current = Date.now();
    }

    if (remaining <= 0) {
      const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
      onComplete(elapsed);
      return;
    }

    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  const pct = Math.min(100, ((totalSeconds - remaining) / totalSeconds) * 100);
  const m = Math.floor(remaining / 60);
  const s = remaining % 60;

  function handleSkip() {
    const elapsed = startedAtRef.current
      ? Math.floor((Date.now() - startedAtRef.current) / 1000)
      : 0;
    onSkip(elapsed);
  }

  return (
    <div className="rounded-[var(--radius-app)] border border-emerald-500/40 bg-emerald-500/10 p-4 text-center space-y-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
        Rest
      </p>
      <p className="text-4xl font-mono font-bold text-foreground tabular-nums">
        {m}:{s.toString().padStart(2, "0")}
      </p>

      <div className="h-1.5 w-full rounded-full bg-emerald-500/20">
        <div
          className="h-1.5 rounded-full bg-emerald-500 transition-all duration-1000"
          style={{ width: `${pct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={handleSkip}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <SkipForward className="h-4 w-4" />
        Skip rest
      </button>
    </div>
  );
}
