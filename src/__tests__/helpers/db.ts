import Database from "better-sqlite3";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// Must be updated when new migrations are added.
const MIGRATIONS = [
  "20260621053453_init_user/migration.sql",
  "20260621091927_add_user_isadmin/migration.sql",
  "20260621102416_m2_data_model/migration.sql",
  "20260621102500_system_exercise_partial_index/migration.sql",
  "20260621143530_add_exercise_isarchived/migration.sql",
  "20260621151818_add_exercise_instructions_pitfalls/migration.sql",
  "20260622143819_add_onboarding_complete/migration.sql",
  "20260622153438_add_body_metric_created_at/migration.sql",
  "20260623182123_add_user_timezone/migration.sql",
];

export function createTestDb(): PrismaClient {
  // Each call gets its own temp file so test files never share state.
  const dbPath = join(
    tmpdir(),
    `healthtest_${Date.now()}_${Math.random().toString(36).slice(2)}.db`,
  );

  // Apply migrations via better-sqlite3 directly, then close.
  const sqlite = new Database(dbPath);
  const migDir = join(process.cwd(), "prisma", "migrations");

  for (const m of MIGRATIONS) {
    const sql = readFileSync(join(migDir, m), "utf-8");
    for (const stmt of sql
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)) {
      try {
        sqlite.exec(stmt);
      } catch {
        // Ignore "already exists" from the partial index migration
      }
    }
  }
  sqlite.close();

  // Open Prisma pointing at the now-migrated file.
  const adapter = new PrismaBetterSqlite3({ url: `file:${dbPath}` });
  const client = new PrismaClient({ adapter, log: [] });

  // Patch $disconnect to clean up the temp file.
  const origDisconnect = client.$disconnect.bind(client);
  client.$disconnect = async () => {
    await origDisconnect();
    try {
      unlinkSync(dbPath);
    } catch {}
  };

  return client;
}

export async function seedTestUser(
  client: PrismaClient,
  overrides: Partial<{
    email: string;
    displayName: string;
    isAdmin: boolean;
    unitPreference: string;
    onboardingComplete: boolean;
    timezone: string;
  }> = {},
) {
  const bcrypt = await import("bcryptjs");
  const passwordHash = await bcrypt.hash("TestPass123!", 1); // cost 1 for speed
  return client.user.create({
    data: {
      email: overrides.email ?? "test@example.com",
      displayName: overrides.displayName ?? "Test User",
      passwordHash,
      unitPreference: overrides.unitPreference ?? "KG",
      isAdmin: overrides.isAdmin ?? false,
      onboardingComplete: overrides.onboardingComplete ?? true,
      timezone: overrides.timezone ?? "UTC",
    },
    select: { id: true },
  });
}

export async function seedTestExercise(
  client: PrismaClient,
  ownerId: string | null,
  name = "Test Squat",
) {
  return client.exercise.create({
    data: {
      ownerId,
      isSystem: ownerId === null,
      name,
      equipment: "BARBELL",
      primaryMuscles: ["QUADS"],
      secondaryMuscles: [],
      isArchived: false,
    },
    select: { id: true },
  });
}
