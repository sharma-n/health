// Seed the shared system-exercise library (SPEC.md §9.1). System exercises have
// `isSystem = true` and `ownerId = null`; they are readable by every user and
// read-only (an "edit" clones an owned copy — Milestone 3).
//
// Idempotent: re-running inserts only the exercises that are missing, so it is
// safe to run on every container start. The partial unique index
// `Exercise_system_name_key` (ON "Exercise"("name") WHERE isSystem) is the
// DB-level safety net; this script's find-or-create is the app-level guard.
//
// Run with `npx prisma db seed` (wired in prisma.config.ts) or `npm run db:seed`.

import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import type { Equipment, MuscleGroup } from "../src/lib/constants";

type SeedExercise = {
  name: string;
  equipment: Equipment;
  primaryMuscles: MuscleGroup[];
  secondaryMuscles?: MuscleGroup[];
  description?: string;
};

// The system exercise library — a covering set of ~40 core movements across
// all equipment types and muscle groups. Curation: focus on compound movements,
// essentials, and common accessories; lean toward what a home or commercial gym
// would stock. Each exercise explicitly lists primary and secondary targets.
const SYSTEM_EXERCISES: SeedExercise[] = [
  // Barbell
  {
    name: "Barbell Bench Press",
    equipment: "BARBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Classic pressing movement; the primary chest builder.",
  },
  {
    name: "Barbell Back Squat",
    equipment: "BARBELL",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Compound leg movement; heavy quad focus with posterior chain involvement.",
  },
  {
    name: "Barbell Deadlift",
    equipment: "BARBELL",
    primaryMuscles: ["GLUTES", "HAMSTRINGS"],
    secondaryMuscles: ["BACK", "QUADS"],
    description: "Full-body compound; the ultimate posterior chain builder.",
  },
  {
    name: "Barbell Bent-Over Row",
    equipment: "BARBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "Classic back thickness builder; compound pulling movement.",
  },
  {
    name: "Barbell Overhead Press",
    equipment: "BARBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS", "CHEST"],
    description: "Standing overhead press; primary shoulder strength developer.",
  },
  {
    name: "Barbell Curl",
    equipment: "BARBELL",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Isolation bicep exercise; classic arm builder.",
  },

  // Dumbbell
  {
    name: "Dumbbell Bench Press",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Dumbbells allow a greater range of motion than barbell pressing.",
  },
  {
    name: "Dumbbell Rows",
    equipment: "DUMBBELL",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "One-arm rows; unilateral back and lat development.",
  },
  {
    name: "Dumbbell Shoulder Press",
    equipment: "DUMBBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS"],
    description: "Bilateral shoulder pressing with dumbbells; stability challenge.",
  },
  {
    name: "Dumbbell Flyes",
    equipment: "DUMBBELL",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Isolation chest movement; excellent pec stretch and activation.",
  },
  {
    name: "Dumbbell Curls",
    equipment: "DUMBBELL",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Classic arm isolation; two-arm bicep builder.",
  },
  {
    name: "Dumbbell Lateral Raise",
    equipment: "DUMBBELL",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRAPS"],
    description: "Side delt isolation; crucial for shoulder width.",
  },
  {
    name: "Dumbbell Goblet Squat",
    equipment: "DUMBBELL",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Unloaded squat variation; mobility and leg development.",
  },
  {
    name: "Dumbbell Tricep Extension",
    equipment: "DUMBBELL",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: [],
    description: "Overhead tricep isolation; lockout strength builder.",
  },

  // Machine
  {
    name: "Leg Press",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: ["GLUTES", "HAMSTRINGS"],
    description: "Lower body pressing machine; heavy quad focus.",
  },
  {
    name: "Chest Press Machine",
    equipment: "MACHINE",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS"],
    description: "Guided pressing movement; stable chest development.",
  },
  {
    name: "Lat Pulldown",
    equipment: "MACHINE",
    primaryMuscles: ["LATS"],
    secondaryMuscles: ["BICEPS", "BACK"],
    description: "Vertical pulling machine; lat width and back thickness.",
  },
  {
    name: "Leg Curl",
    equipment: "MACHINE",
    primaryMuscles: ["HAMSTRINGS"],
    secondaryMuscles: ["GLUTES"],
    description: "Hamstring isolation; knee flexion movement.",
  },
  {
    name: "Leg Extension",
    equipment: "MACHINE",
    primaryMuscles: ["QUADS"],
    secondaryMuscles: [],
    description: "Quadriceps isolation; knee extension machine.",
  },
  {
    name: "Shoulder Press Machine",
    equipment: "MACHINE",
    primaryMuscles: ["SHOULDERS"],
    secondaryMuscles: ["TRICEPS"],
    description: "Seated or standing shoulder press; controlled overhead pressing.",
  },

  // Cable
  {
    name: "Cable Chest Flyes",
    equipment: "CABLE",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Constant tension chest isolation; pec pump.",
  },
  {
    name: "Cable Rows",
    equipment: "CABLE",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS", "LATS"],
    description: "Horizontal pulling cable movement; back and lat development.",
  },
  {
    name: "Cable Bicep Curls",
    equipment: "CABLE",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["FOREARMS"],
    description: "Constant tension bicep isolation; full range activation.",
  },
  {
    name: "Cable Tricep Pushdown",
    equipment: "CABLE",
    primaryMuscles: ["TRICEPS"],
    secondaryMuscles: [],
    description: "Tricep isolation at the cable stack; arm finisher.",
  },

  // Kettlebell
  {
    name: "Kettlebell Swing",
    equipment: "KETTLEBELL",
    primaryMuscles: ["GLUTES", "HAMSTRINGS"],
    secondaryMuscles: ["BACK", "SHOULDERS"],
    description: "Explosive hip hinge; posterior chain power and endurance.",
  },
  {
    name: "Kettlebell Turkish Get-up",
    equipment: "KETTLEBELL",
    primaryMuscles: ["SHOULDERS", "CHEST"],
    secondaryMuscles: ["ABS", "GLUTES"],
    description: "Complex multi-joint movement; full-body strength and stability.",
  },

  // Bodyweight
  {
    name: "Push-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS", "SHOULDERS"],
    description: "Classic pressing movement; no equipment needed.",
  },
  {
    name: "Pull-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["LATS"],
    secondaryMuscles: ["BICEPS", "BACK"],
    description: "Vertical pulling; compound back and arm builder.",
  },
  {
    name: "Dips",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["TRICEPS", "CHEST"],
    secondaryMuscles: ["SHOULDERS"],
    description: "Compound pressing movement; chest and arm focus.",
  },
  {
    name: "Bodyweight Squats",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Leg movement with zero equipment; endurance and form work.",
  },
  {
    name: "Lunges",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["QUADS", "GLUTES"],
    secondaryMuscles: ["HAMSTRINGS"],
    description: "Single-leg movement; balance and unilateral leg development.",
  },
  {
    name: "Planks",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: ["OBLIQUES"],
    description: "Core isometric hold; stability and endurance.",
  },
  {
    name: "Crunches",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["ABS"],
    secondaryMuscles: [],
    description: "Isolation abdominal flexion; upper ab focus.",
  },
  {
    name: "Chin-ups",
    equipment: "BODYWEIGHT",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: ["LATS", "BACK"],
    description: "Supinated pull-up; stronger bicep involvement than pull-ups.",
  },

  // Bands
  {
    name: "Resistance Band Rows",
    equipment: "BAND",
    primaryMuscles: ["BACK"],
    secondaryMuscles: ["BICEPS"],
    description: "Portable pulling movement; back and arm development.",
  },
  {
    name: "Resistance Band Chest Press",
    equipment: "BAND",
    primaryMuscles: ["CHEST"],
    secondaryMuscles: ["TRICEPS"],
    description: "Band pressing; variable resistance chest work.",
  },
  {
    name: "Resistance Band Curls",
    equipment: "BAND",
    primaryMuscles: ["BICEPS"],
    secondaryMuscles: [],
    description: "Band isolation for biceps; portable arm training.",
  },
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  try {
    let created = 0;
    for (const ex of SYSTEM_EXERCISES) {
      const existing = await prisma.exercise.findFirst({
        where: { name: ex.name, isSystem: true },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.exercise.create({
        data: {
          isSystem: true,
          ownerId: null,
          name: ex.name,
          description: ex.description ?? null,
          equipment: ex.equipment,
          primaryMuscles: ex.primaryMuscles,
          secondaryMuscles: ex.secondaryMuscles ?? [],
        },
      });
      created += 1;
    }

    console.log(
      `Seed complete: ${created} system exercise(s) created, ` +
        `${SYSTEM_EXERCISES.length - created} already present.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
