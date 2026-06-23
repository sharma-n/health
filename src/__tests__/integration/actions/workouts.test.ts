import { createTestDb, seedTestUser, seedTestExercise } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  createWorkoutAction,
  updateWorkoutAction,
  deleteWorkoutAction,
} from "@/lib/actions/workouts";

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
  const { id: userId } = await seedTestUser(db, { email: `wo-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

describe("createWorkoutAction", () => {
  it("returns Unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await createWorkoutAction({}, new FormData());
    expect(result.error).toBe("Unauthorized.");
  });

  it("returns fieldErrors when name is missing", async () => {
    await setup();
    const result = await createWorkoutAction({}, new FormData());
    expect(result.fieldErrors?.name).toBeDefined();
  });

  it("creates a workout and redirects", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `WEx-${Date.now()}`);

    const fd = new FormData();
    fd.set("name", "Push Day");
    fd.set("exercises", JSON.stringify([{ exerciseId: exId, order: 0, targetSets: 3, targetReps: 10 }]));
    await createWorkoutAction({}, fd);

    expect(redirect).toHaveBeenCalledWith(expect.stringMatching(/^\/workouts\//));

    const workout = await db.workout.findFirst({ where: { ownerId: userId, name: "Push Day" } });
    expect(workout).not.toBeNull();
    const exercises = await db.workoutExercise.findMany({ where: { workoutId: workout!.id } });
    expect(exercises).toHaveLength(1);
    expect(exercises[0].targetSets).toBe(3);
  });
});

describe("updateWorkoutAction", () => {
  it("updates name and replaces exercises", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `WEx2-${Date.now()}`);
    const { id: workoutId } = await db.workout.create({
      data: { ownerId: userId, name: "Old Name" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("workoutId", workoutId);
    fd.set("name", "New Name");
    fd.set("exercises", JSON.stringify([{ exerciseId: exId, order: 0 }]));
    await updateWorkoutAction({}, fd);

    const updated = await db.workout.findUnique({ where: { id: workoutId } });
    expect(updated?.name).toBe("New Name");
  });

  it("returns not found for another user's workout", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `oth2-${Date.now()}@test.com` });
    const { id: workoutId } = await db.workout.create({
      data: { ownerId: otherId, name: "Other Workout" },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("workoutId", workoutId);
    fd.set("name", "Stolen");
    fd.set("exercises", JSON.stringify([]));
    const result = await updateWorkoutAction({}, fd);
    expect(result.error).toBe("Workout not found.");
  });
});

describe("deleteWorkoutAction", () => {
  it("deletes a workout and redirects to /workouts", async () => {
    const { db, userId } = await setup();
    const { id: workoutId } = await db.workout.create({
      data: { ownerId: userId, name: "To Delete" },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("workoutId", workoutId);
    await deleteWorkoutAction({}, fd);
    expect(redirect).toHaveBeenCalledWith("/workouts");

    const deleted = await db.workout.findUnique({ where: { id: workoutId } });
    expect(deleted).toBeNull();
  });
});
