import { createTestDb, seedTestUser, seedTestExercise } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  startSessionAction,
  addExerciseToSessionAction,
  upsertSetAction,
  setRestAction,
  completeSessionAction,
  deleteSessionAction,
} from "@/lib/actions/session";

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
  const { id: userId } = await seedTestUser(db, { email: `sess-${Date.now()}@test.com` });
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
  return { db, userId };
}

describe("startSessionAction", () => {
  it("creates an ad-hoc session and redirects", async () => {
    const { db, userId } = await setup();
    await startSessionAction(new FormData());
    expect(redirect).toHaveBeenCalledWith(expect.stringMatching(/^\/sessions\//));

    const session = await db.session.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } });
    expect(session).not.toBeNull();
    expect(session?.endedAt).toBeNull();
  });

  it("pre-populates exercises when workoutId provided", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `SEx-${Date.now()}`);
    const { id: workoutId } = await db.workout.create({
      data: {
        ownerId: userId, name: "W",
        exercises: { createMany: { data: [{ exerciseId: exId, order: 0 }] } },
      },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("workoutId", workoutId);
    await startSessionAction(fd);

    const session = await db.session.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } });
    const exercises = await db.sessionExercise.findMany({ where: { sessionId: session!.id } });
    expect(exercises).toHaveLength(1);
    expect(exercises[0].exerciseId).toBe(exId);
  });
});

describe("addExerciseToSessionAction", () => {
  it("returns Unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await addExerciseToSessionAction("sess-id", "ex-id");
    expect(result.error).toBe("Unauthorized.");
  });

  it("adds an exercise to an active session", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `AddEx-${Date.now()}`);
    const { id: sessionId } = await db.session.create({
      data: { userId, startedAt: new Date() },
      select: { id: true },
    });

    const result = await addExerciseToSessionAction(sessionId, exId);
    expect(result.success).toBeDefined();
    expect(result.sessionExerciseId).toBeDefined();

    const se = await db.sessionExercise.findFirst({ where: { sessionId } });
    expect(se).not.toBeNull();
  });

  it("returns error when session already completed", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `AddEx2-${Date.now()}`);
    const { id: sessionId } = await db.session.create({
      data: { userId, startedAt: new Date(), endedAt: new Date() },
      select: { id: true },
    });

    const result = await addExerciseToSessionAction(sessionId, exId);
    expect(result.error).toBe("Session already completed.");
  });
});

describe("upsertSetAction", () => {
  it("returns Unauthorized when not authenticated", async () => {
    vi.mocked(auth).mockResolvedValue(null);
    const result = await upsertSetAction({ sessionExerciseId: "se-id", setNumber: 1, completed: false });
    expect(result.error).toBe("Unauthorized.");
  });

  it("creates a new set", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `UpsEx-${Date.now()}`);
    const { id: sessionId } = await db.session.create({ data: { userId, startedAt: new Date() }, select: { id: true } });
    const { id: seId } = await db.sessionExercise.create({ data: { sessionId, exerciseId: exId, order: 0 }, select: { id: true } });

    const result = await upsertSetAction({ sessionExerciseId: seId, setNumber: 1, weightKg: 100, reps: 5, completed: true });
    expect(result.setId).toBeDefined();
    expect(result.success).toBeDefined();

    const set = await db.sessionSet.findUnique({ where: { id: result.setId! } });
    expect(set?.weightKg).toBe(100);
    expect(set?.reps).toBe(5);
    expect(set?.completed).toBe(true);
  });

  it("updates an existing set when id is provided", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `UpdEx-${Date.now()}`);
    const { id: sessionId } = await db.session.create({ data: { userId, startedAt: new Date() }, select: { id: true } });
    const { id: seId } = await db.sessionExercise.create({ data: { sessionId, exerciseId: exId, order: 0 }, select: { id: true } });

    const { setId } = await upsertSetAction({ sessionExerciseId: seId, setNumber: 1, weightKg: 80, reps: 8, completed: false });
    const updated = await upsertSetAction({ id: setId!, sessionExerciseId: seId, setNumber: 1, weightKg: 85, reps: 8, completed: true });

    expect(updated.setId).toBe(setId);
    const set = await db.sessionSet.findUnique({ where: { id: setId! } });
    expect(set?.weightKg).toBe(85);
    expect(set?.completed).toBe(true);
  });
});

describe("setRestAction", () => {
  it("records actual rest taken on a set", async () => {
    const { db, userId } = await setup();
    const { id: exId } = await seedTestExercise(db, userId, `RestEx-${Date.now()}`);
    const { id: sessionId } = await db.session.create({ data: { userId, startedAt: new Date() }, select: { id: true } });
    const { id: seId } = await db.sessionExercise.create({ data: { sessionId, exerciseId: exId, order: 0 }, select: { id: true } });
    const { id: setId } = await db.sessionSet.create({ data: { sessionExerciseId: seId, setNumber: 1, completed: true }, select: { id: true } });

    const result = await setRestAction(setId, 90);
    expect(result.success).toBeDefined();

    const set = await db.sessionSet.findUnique({ where: { id: setId } });
    expect(set?.restSeconds).toBe(90);
  });
});

describe("completeSessionAction", () => {
  it("sets endedAt and records effort", async () => {
    const { db, userId } = await setup();
    const { id: sessionId } = await db.session.create({
      data: { userId, startedAt: new Date(Date.now() - 60_000) },
      select: { id: true },
    });

    const fd = new FormData();
    fd.set("sessionId", sessionId);
    fd.set("overallEffort", "7");
    fd.set("notes", "Good session");
    await completeSessionAction({}, fd);

    expect(redirect).toHaveBeenCalledWith(`/sessions/${sessionId}`);
    const session = await db.session.findUnique({ where: { id: sessionId } });
    expect(session?.endedAt).not.toBeNull();
    expect(session?.durationSeconds).toBeGreaterThan(0);
    expect(session?.overallEffort).toBe(7);
    expect(session?.notes).toBe("Good session");
  });

  it("returns error if session already completed", async () => {
    const { db, userId } = await setup();
    const { id: sessionId } = await db.session.create({
      data: { userId, startedAt: new Date(), endedAt: new Date() },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("sessionId", sessionId);
    const result = await completeSessionAction({}, fd);
    expect(result.error).toBe("Session already completed.");
  });
});

describe("deleteSessionAction", () => {
  it("deletes a completed session and redirects", async () => {
    const { db, userId } = await setup();
    const { id: sessionId } = await db.session.create({
      data: { userId, startedAt: new Date(), endedAt: new Date() },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("sessionId", sessionId);
    await deleteSessionAction({}, fd);
    expect(redirect).toHaveBeenCalledWith("/sessions");

    const session = await db.session.findUnique({ where: { id: sessionId } });
    expect(session).toBeNull();
  });

  it("returns not found for another user's session", async () => {
    const { db } = await setup();
    const { id: otherId } = await seedTestUser(db, { email: `deloth-${Date.now()}@test.com` });
    const { id: sessionId } = await db.session.create({
      data: { userId: otherId, startedAt: new Date() },
      select: { id: true },
    });

    const fd = new FormData(); fd.set("sessionId", sessionId);
    const result = await deleteSessionAction({}, fd);
    expect(result.error).toBe("Session not found.");
  });
});
