"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ExerciseForPicker } from "@/lib/analytics/progression";

interface ExerciseSelectorProps {
  exercises: ExerciseForPicker[];
  selectedId: string | null;
}

export function ExerciseSelector({ exercises, selectedId }: ExerciseSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("exercise", e.target.value);
    router.push(`/analytics?${params.toString()}`);
  }

  return (
    <select
      value={selectedId ?? ""}
      onChange={onChange}
      className="w-full rounded-[var(--radius-app)] border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
    >
      <option value="" disabled>
        Select an exercise…
      </option>
      {exercises.map((ex) => (
        <option key={ex.id} value={ex.id}>
          {ex.name}
          {ex.isSystem ? "" : " ★"}
        </option>
      ))}
    </select>
  );
}
