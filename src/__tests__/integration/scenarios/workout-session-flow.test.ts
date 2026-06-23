/**
 * End-to-end user journey: exercise → workout → session → log sets → complete → analytics
 * No browser; every step calls real server actions against an in-memory SQLite DB.
 */
import { createTestDb, seedTestUser } from "../../helpers/db";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { createExerciseAction } from "@/lib/actions/exercises";
import { createWorkoutAction } from "@/lib/actions/workouts";
import { startSessionAction, addExerciseToSessionAction, upsertSetAction, completeSessionAction } from "@/lib/actions/session";
import { getExerciseProgression } from "@/lib/analytics/progression";
import { getPersonalRecords } from "@/lib/analytics/prs";

let db: any;
let userId: string;

beforeAll(async () => {
  db = createTestDb();
  (globalThis as any).__testDb = db;
  ({ id: userId } = await seedTestUser(db, { email: `journey-${Date.now()}@test.com` }));
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
});

afterAll(async () => {
  await db.$disconnect();
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ user: { id: userId } } as any);
});

it("full workout-session journey produces analytics data", async () => {
  // 1. Create exercise
  const exFd = new FormData();
  exFd.set("name", "Journey Squat");
  exFd.set("equipment", "BARBELL");
  exFd.set("primaryMuscles", JSON.stringify(["QUADS"]));
  exFd.set("secondaryMuscles", JSON.stringify(["HAMSTRINGS"]));
  await createExerciseAction({}, exFd);

  const exercise = await db.exercise.findFirst({ where: { name: "Journey Squat", ownerId: userId } });
  expect(exercise).not.toBeNull();

  // 2. Build a workout with that exercise
  const wFd = new FormData();
  wFd.set("name", "Journey Push");
  wFd.set("exercises", JSON.stringify([{ exerciseId: exercise.id, order: 0, targetSets: 3, targetReps: 5 }]));
  await createWorkoutAction({}, wFd);
  vi.mocked(redirect).mockClear();

  const workout = await db.workout.findFirst({ where: { ownerId: userId, name: "Journey Push" } });
  expect(workout).not.toBeNull();

  // 3. Start session from workout (exercises pre-populated)
  const sFd = new FormData(); sFd.set("workoutId", workout.id);
  await startSessionAction(sFd);

  const session = await db.session.findFirst({ where: { userId }, orderBy: { startedAt: "desc" } });
  expect(session).not.toBeNull();
  expect(session.endedAt).toBeNull();

  const sessionExercises = await db.sessionExercise.findMany({ where: { sessionId: session.id } });
  expect(sessionExercises).toHaveLength(1);
  const se = sessionExercises[0];

  // 4. Log 3 sets
  await upsertSetAction({ sessionExerciseId: se.id, setNumber: 1, weightKg: 100, reps: 5, completed: true });
  await upsertSetAction({ sessionExerciseId: se.id, setNumber: 2, weightKg: 102.5, reps: 5, completed: true });
  await upsertSetAction({ sessionExerciseId: se.id, setNumber: 3, weightKg: 102.5, reps: 3, completed: true });

  const sets = await db.sessionSet.findMany({ where: { sessionExerciseId: se.id } });
  expect(sets).toHaveLength(3);
  expect(sets.filter((s: any) => s.completed)).toHaveLength(3);

  // 5. Complete the session with effort rating
  const cFd = new FormData();
  cFd.set("sessionId", session.id);
  cFd.set("overallEffort", "8");
  cFd.set("notes", "Felt strong today");
  await completeSessionAction({}, cFd);

  const completed = await db.session.findUnique({ where: { id: session.id } });
  expect(completed.endedAt).not.toBeNull();
  expect(completed.durationSeconds).toBeGreaterThanOrEqual(0);
  expect(completed.overallEffort).toBe(8);
  expect(completed.notes).toBe("Felt strong today");

  // 6. Analytics: progression should show top weight from this session
  const progression = await getExerciseProgression(userId, exercise.id, db);
  expect(progression).toHaveLength(1);
  expect(progression[0].topWeightKg).toBe(102.5);
  // Epley 1RM with best set (102.5 × 5 reps): 102.5 × (1 + 5/30) ≈ 119.6
  expect(progression[0].estimatedOneRM).toBeCloseTo(119.6, 0);

  // 7. Add a second (lighter) session so getPersonalRecords has >= 2 sessions to compare
  const s2Fd = new FormData(); s2Fd.set("workoutId", workout.id);
  await startSessionAction(s2Fd);
  const session2 = await db.session.findFirst({
    where: { userId, NOT: { id: session.id } },
    orderBy: { startedAt: "desc" },
  });
  const se2 = await db.sessionExercise.findFirst({ where: { sessionId: session2.id } });
  await upsertSetAction({ sessionExerciseId: se2.id, setNumber: 1, weightKg: 80, reps: 5, completed: true });
  const c2Fd = new FormData(); c2Fd.set("sessionId", session2.id);
  await completeSessionAction({}, c2Fd);

  // 8. PRs: session 1 should be the all-time best
  const prs = await getPersonalRecords(userId, db);
  const squat = prs.find((pr: any) => pr.exerciseName === "Journey Squat");
  expect(squat).toBeDefined();
  expect(squat.isNew).toBe(true); // within 14 days
});
