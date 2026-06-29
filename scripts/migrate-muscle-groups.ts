// One-off migration script: replaces deprecated muscle group constants that were
// removed in the muscle-group expansion with their modern equivalents.
//
// Deprecated → replacement mapping:
//   BACK      → [UPPER_BACK, LATS]     (conservative: keeps both; seed is more specific)
//   SHOULDERS → [FRONT_DELTS, REAR_DELTS]
//   FULL_BODY → []                      (too ambiguous; user must re-tag)
//
// Only touches user-owned (non-system) exercises. System exercises are handled by
// re-running `npm run db:seed` (the seed update branch now refreshes muscle arrays).
//
// Idempotent: a second run is a no-op because none of the deprecated values will
// remain after the first run.
//
// Usage:  npm run db:migrate-muscles

import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";

type MuscleGroupString = string;

const REPLACEMENTS: Record<MuscleGroupString, MuscleGroupString[]> = {
  BACK: ["UPPER_BACK", "LATS"],
  SHOULDERS: ["FRONT_DELTS", "REAR_DELTS"],
  FULL_BODY: [],
};

const DEPRECATED = new Set(Object.keys(REPLACEMENTS));

function migrateArray(arr: MuscleGroupString[]): { result: MuscleGroupString[]; changed: boolean } {
  let changed = false;
  const out: MuscleGroupString[] = [];
  const seen = new Set<MuscleGroupString>();

  for (const m of arr) {
    if (DEPRECATED.has(m)) {
      changed = true;
      for (const replacement of REPLACEMENTS[m]) {
        if (!seen.has(replacement)) {
          seen.add(replacement);
          out.push(replacement);
        }
      }
    } else {
      if (!seen.has(m)) {
        seen.add(m);
        out.push(m);
      }
    }
  }

  return { result: out, changed };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");

  const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url }) });

  try {
    // Only migrate user-owned (non-system) exercises
    const exercises = await prisma.exercise.findMany({
      where: { isSystem: false },
      select: { id: true, name: true, primaryMuscles: true, secondaryMuscles: true },
    });

    let migratedCount = 0;
    let clearedCount = 0;

    for (const ex of exercises) {
      const primary = Array.isArray(ex.primaryMuscles) ? (ex.primaryMuscles as MuscleGroupString[]) : [];
      const secondary = Array.isArray(ex.secondaryMuscles) ? (ex.secondaryMuscles as MuscleGroupString[]) : [];

      const { result: newPrimary, changed: primaryChanged } = migrateArray(primary);
      const { result: newSecondary, changed: secondaryChanged } = migrateArray(secondary);

      if (!primaryChanged && !secondaryChanged) continue;

      await prisma.exercise.update({
        where: { id: ex.id },
        data: {
          primaryMuscles: newPrimary,
          secondaryMuscles: newSecondary,
        },
      });

      migratedCount += 1;

      // Track FULL_BODY clears separately for user awareness
      if (primary.includes("FULL_BODY") || secondary.includes("FULL_BODY")) {
        clearedCount += 1;
        console.log(`  ⚠ "${ex.name}": FULL_BODY cleared — please re-tag this exercise.`);
      }
    }

    console.log(`\nMigration complete:`);
    console.log(`  ${exercises.length} user exercises scanned`);
    console.log(`  ${migratedCount} exercises updated`);
    if (clearedCount > 0) {
      console.log(`  ${clearedCount} exercise(s) had FULL_BODY cleared — re-tag them manually`);
    }
    console.log(`\nTo migrate system exercises, run: npm run db:seed`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
