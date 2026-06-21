import type { Metadata } from "next";

import { PageHeader } from "@/components/app-shell/page-header";
import { ExerciseForm } from "@/components/exercises/exercise-form";
import { createExerciseAction } from "@/lib/actions/exercises";

export const metadata: Metadata = { title: "New Exercise — Health" };

export default function NewExercisePage() {
  return (
    <div>
      <PageHeader title="New Exercise" />
      <ExerciseForm action={createExerciseAction} submitLabel="Create exercise" />
    </div>
  );
}
