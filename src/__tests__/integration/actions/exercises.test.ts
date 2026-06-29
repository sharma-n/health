import { createTestDb, seedTestUser, seedTestExercise } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  createExerciseAction,
  archiveExerciseAction,
  unarchiveExerciseAction,
  deleteExerciseAction,
  cloneExerciseAction,
} from "@/lib/actions/exercises";

beforeAll(async () => {
  (globalThis as any).__testDb = createTestDb();
});

afterAll(async () => {
  await (globalThis as any).__testDb.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
});

async function setup() {
  const db = (globalThis as any).__testDb;
  const { id: userId } = await seedTestUser(db, { email: `ex-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

// ── createExerciseAction ────────────────────────────────────────────────────

describe("createExerciseAction", () => {
  it("returns Unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await createExerciseAction({}, new FormData());
    expect(result.error).toBe("Unauthorized.");
  });

  it("returns fieldErrors when name is missing", async () => {
    await setup();
    const fd = new FormData();
    fd.set("equipment", "BARBELL");
    fd.set("primaryMuscles", JSON.stringify(["QUADS"]));
    fd.set("secondaryMuscles", JSON.stringify([]));
    const result = await createExerciseAction({}, fd);
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("creates exercise and redirects", async () => {
    const { db, userId } = await setup();
    const fd = new FormData();
    fd.set("name", "Test Deadlift");
    fd.set("equipment", "BARBELL");
    fd.set("primaryMuscles", JSON.stringify(["UPPER_BACK"]));
    fd.set("secondaryMuscles", JSON.stringify(["HAMSTRINGS"]));
    await createExerciseAction({}, fd);

    expect(redirect).toHaveBeenCalledWith("/exercises");
    expect(revalidatePath).toHaveBeenCalledWith("/exercises");

    const created = await db.exercise.findFirst({ where: { name: "Test Deadlift", ownerId: userId } });
    expect(created).not.toBeNull();
    expect(created?.isSystem).toBe(false);
    expect(created?.isArchived).toBe(false);
  });
});

// ── archiveExerciseAction ───────────────────────────────────────────────────

describe("archiveExerciseAction", () => {
  it("archives a user-owned exercise", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `Archive-${Date.now()}`);

    const fd = new FormData(); fd.set("exerciseId", exId);
    const result = await archiveExerciseAction({}, fd);
    expect(result.success).toBeDefined();

    const ex = await db.exercise.findUnique({ where: { id: exId } });
    expect(ex?.isArchived).toBe(true);
  });

  it("returns not found for another user's exercise", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `other-${Date.now()}@test.com` });
    const { id: exId } = await seedTestExercise(db, otherId, `OtherEx-${Date.now()}`);

    const fd = new FormData(); fd.set("exerciseId", exId);
    const result = await archiveExerciseAction({}, fd);
    expect(result.error).toBe("Exercise not found.");
  });
});

// ── unarchiveExerciseAction ─────────────────────────────────────────────────

describe("unarchiveExerciseAction", () => {
  it("unarchives an archived exercise", async () => {
    const { db, userId } = await setup();
    const name = `Unarchive-${Date.now()}`;
    const { id: exId } = await seedTestExercise(db, userId, name);
    await db.exercise.update({ where: { id: exId }, data: { isArchived: true } });

    const fd = new FormData(); fd.set("exerciseId", exId);
    const result = await unarchiveExerciseAction({}, fd);
    expect(result.success).toBeDefined();

    const ex = await db.exercise.findUnique({ where: { id: exId } });
    expect(ex?.isArchived).toBe(false);
  });
});

// ── deleteExerciseAction ────────────────────────────────────────────────────

describe("deleteExerciseAction", () => {
  it("deletes an unreferenced exercise", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `Delete-${Date.now()}`);

    const fd = new FormData(); fd.set("exerciseId", exId);
    await deleteExerciseAction({}, fd);
    expect(redirect).toHaveBeenCalledWith("/exercises");

    const ex = await db.exercise.findUnique({ where: { id: exId } });
    expect(ex).toBeNull();
  });

  it("blocks delete when exercise is referenced in a workout", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `Protected-${Date.now()}`);
    const { id: workoutId } = await db.workout.create({
      data: { ownerId: userId, name: "W" },
      select: { id: true },
    });
    await db.workoutExercise.create({ data: { workoutId, exerciseId: exId, order: 0 } });

    const fd = new FormData(); fd.set("exerciseId", exId);
    const result = await deleteExerciseAction({}, fd);
    expect(result.error).toMatch(/used in workouts/i);
  });
});

// ── cloneExerciseAction ─────────────────────────────────────────────────────

describe("cloneExerciseAction", () => {
  it("clones a system exercise and creates user-owned copy", async () => {
    const { db, userId } = await setup();
    const { id: systemExId } = await seedTestExercise(db, null, `System-${Date.now()}`);

    const fd = new FormData();
    fd.set("exerciseId", systemExId);
    fd.set("name", "My Clone");
    await cloneExerciseAction({}, fd);

    const clone = await db.exercise.findFirst({ where: { ownerId: userId, name: "My Clone" } });
    expect(clone).not.toBeNull();
    expect(clone?.isSystem).toBe(false);
  });
});
