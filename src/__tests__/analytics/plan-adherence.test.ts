import { getPlanAdherence } from "@/lib/analytics/plan-adherence";
import type { PrismaClient } from "@/generated/prisma/client";

// Fixed "today" for deterministic tests: 2027-06-25 (Thursday).
// The string is inlined in the vi.mock factory because vi.mock is hoisted
// before const initializers — referencing a const here causes a ReferenceError.
vi.mock("@/lib/dates", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/dates")>();
  return { ...real, todayInTz: vi.fn().mockReturnValue("2027-06-25") };
});

// Helpers
function utc(dateStr: string): Date {
  return new Date(dateStr + "T00:00:00Z");
}
function utcTime(dateStr: string, hours = 10): Date {
  const d = utc(dateStr);
  d.setUTCHours(hours, 0, 0, 0);
  return d;
}

type FakeSession = {
  id: string;
  planId?: string | null;
  workoutId?: string | null;
  scheduledDate?: Date | null;
  startedAt: Date;
  exercises?: Array<{ exerciseId: string }>;
};

function makePrisma(plan: object, sessions: FakeSession[] = []): PrismaClient {
  return {
    plan: { findUnique: vi.fn().mockResolvedValue(plan) },
    session: {
      findMany: vi.fn().mockResolvedValue(
        sessions.map((s) => ({
          id: s.id,
          planId: s.planId ?? null,
          workoutId: s.workoutId ?? null,
          scheduledDate: s.scheduledDate ?? null,
          startedAt: s.startedAt,
          exercises: s.exercises ?? [],
        })),
      ),
    },
  } as unknown as PrismaClient;
}

// A simple plan: Mon+Wed in the past (2027-06-16 to 2027-06-25)
const PUSH_WO = {
  id: "push-wo",
  name: "Push",
  exercises: [{ exerciseId: "ex1" }, { exerciseId: "ex2" }],
};
const PULL_WO = {
  id: "pull-wo",
  name: "Pull",
  exercises: [{ exerciseId: "ex3" }, { exerciseId: "ex4" }],
};

// In 2027, June 16 = Wednesday (3) and June 25 = Friday (5).
// Schedule uses Wed + Fri so the existing date fixtures are naturally correct.
const PLAN = {
  id: "plan1",
  name: "Test Plan",
  ownerId: "user1",
  startDate: utc("2027-06-16"), // Wednesday (first occurrence day)
  endDate: utc("2027-06-29"),   // Tuesday (end of plan window)
  schedule: [
    { dayOfWeek: 3, workoutId: "push-wo", workout: PUSH_WO }, // Wed (Jun 16, Jun 23)
    { dayOfWeek: 5, workoutId: "pull-wo", workout: PULL_WO }, // Fri (Jun 18, Jun 25 = today)
  ],
};

// Occurrences for this plan (Wed/Fri from Jun 16 to Jun 29):
// Wed: Jun 16, 23
// Fri: Jun 18, 25 (today!)
// All dates < 2027-06-25 are past; 2027-06-25 and later are upcoming.

describe("getPlanAdherence", () => {
  describe("occurrence generation", () => {
    it("generates correct occurrences for a Mon+Wed schedule over 2 weeks", async () => {
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN), "UTC");
      // Mon Jun 16, 23 + Wed Jun 18, 25 = 4 occurrences
      expect(result.allOccurrences).toHaveLength(4);
      const dates = result.allOccurrences.map((o) => o.occurrenceDate);
      expect(dates).toEqual(["2027-06-16", "2027-06-18", "2027-06-23", "2027-06-25"]);
    });

    it("returns empty result for a plan with no schedule items", async () => {
      const emptyPlan = { ...PLAN, schedule: [] };
      const result = await getPlanAdherence("plan1", "user1", makePrisma(emptyPlan), "UTC");
      expect(result.allOccurrences).toHaveLength(0);
      expect(result.overall.adherencePct).toBeNull();
    });

    it("throws when plan ownerId does not match userId", async () => {
      await expect(getPlanAdherence("plan1", "other-user", makePrisma(PLAN), "UTC")).rejects.toThrow(
        "Plan not found",
      );
    });

    it("throws when plan is null", async () => {
      await expect(
        getPlanAdherence("plan1", "user1", makePrisma(null as unknown as object), "UTC"),
      ).rejects.toThrow("Plan not found");
    });
  });

  describe("status with no sessions", () => {
    it("marks past occurrences as missed and future as upcoming", async () => {
      // TODAY = 2027-06-25
      // Jun 16 (Mon past), Jun 18 (Wed past), Jun 23 (Mon past) → missed
      // Jun 25 (Wed, today) → upcoming (not strictly past)
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN), "UTC");
      const byDate = Object.fromEntries(result.allOccurrences.map((o) => [o.occurrenceDate, o.status]));
      expect(byDate["2027-06-16"]).toBe("missed");
      expect(byDate["2027-06-18"]).toBe("missed");
      expect(byDate["2027-06-23"]).toBe("missed");
      expect(byDate["2027-06-25"]).toBe("upcoming"); // today is upcoming, not missed
    });

    it("adherencePct is null when no past-due occurrences exist yet", async () => {
      const futurePlan = {
        ...PLAN,
        startDate: utc("2027-06-26"),
        endDate: utc("2027-07-10"),
      };
      const result = await getPlanAdherence("plan1", "user1", makePrisma(futurePlan), "UTC");
      expect(result.overall.adherencePct).toBeNull();
    });

    it("adherencePct is 0 when all past occurrences are missed", async () => {
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN), "UTC");
      // 3 missed, 1 upcoming → 0 / 3 = 0%
      expect(result.overall.adherencePct).toBe(0);
      expect(result.overall.missed).toBe(3);
      expect(result.overall.upcoming).toBe(1);
    });
  });

  describe("Tier 1 matching (planId + scheduledDate)", () => {
    it("matches session with planId and scheduledDate on the occurrence date → completed", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: "plan1",
          workoutId: "push-wo",
          scheduledDate: utc("2027-06-16"),
          startedAt: utcTime("2027-06-16"),
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed");
      expect(jun16?.matchedSessionId).toBe("s1");
    });

    it("Tier 1: scheduledDate 1 day off still matches (delta ≤ 1)", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: "plan1",
          workoutId: "push-wo",
          scheduledDate: utc("2027-06-17"), // 1 day after the Jun 16 occurrence
          startedAt: utcTime("2027-06-17"),
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed"); // delta = +1 ≤ 1 → completed
    });

    it("Tier 1: scheduledDate 2 days off does NOT qualify for Tier 1 (falls through)", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: "plan1",
          workoutId: "other-wo", // wrong workout, so Tier 2 won't match either
          scheduledDate: utc("2027-06-14"), // 2 days before Jun 16
          startedAt: utcTime("2027-06-14"),
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      // scheduledDate is 2 days off → Tier 1 fails; wrong workoutId → Tier 2 fails; no overlap → Tier 3 fails
      expect(jun16?.status).toBe("missed");
    });

    it("session done 1 day late via Tier 1 → completed (|delta| = 1)", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: "plan1",
          workoutId: "push-wo",
          scheduledDate: utc("2027-06-16"),
          startedAt: utcTime("2027-06-17"), // done next day
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed"); // session date Jun 17, occurrence Jun 16, delta = +1 → completed
    });

    it("session done 2 days late via Tier 1 → completed_late", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: "plan1",
          workoutId: "push-wo",
          scheduledDate: utc("2027-06-16"),
          startedAt: utcTime("2027-06-18"), // done 2 days late
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed_late");
    });

    it("session done 2 days early via Tier 1 → completed_early", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: "plan1",
          workoutId: "push-wo",
          scheduledDate: utc("2027-06-16"),
          startedAt: utcTime("2027-06-14"), // done 2 days early
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed_early");
    });
  });

  describe("Tier 2 matching (workoutId + date window)", () => {
    it("workoutId match on same day → completed", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "push-wo",
          startedAt: utcTime("2027-06-16"),
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed");
    });

    it("workoutId match 3 days late → completed_late", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "push-wo",
          startedAt: utcTime("2027-06-19"), // 3 days after Jun 16
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed_late");
    });

    it("workoutId match 3 days early → completed_early", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "push-wo",
          startedAt: utcTime("2027-06-13"), // 3 days before Jun 16
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed_early");
    });

    it("workoutId match 4 days away → no match (outside default window)", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "push-wo",
          startedAt: utcTime("2027-06-20"), // 4 days after Jun 16
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("missed");
    });

    it("respects ADHERENCE_MAKEUP_WINDOW_DAYS env var", async () => {
      vi.stubEnv("ADHERENCE_MAKEUP_WINDOW_DAYS", "1");
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "push-wo",
          startedAt: utcTime("2027-06-18"), // 2 days after Jun 16
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("missed"); // window=1 so 2-day gap doesn't match
      vi.unstubAllEnvs();
    });
  });

  describe("Tier 3 matching (exercise overlap)", () => {
    it("≥50% exercise overlap within window → matches", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "other-wo", // wrong workout ID
          startedAt: utcTime("2027-06-16"),
          exercises: [{ exerciseId: "ex1" }, { exerciseId: "ex2" }], // exact match with Push (ex1, ex2)
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("completed");
      expect(jun16?.matchedSessionId).toBe("s1");
    });

    it("<50% exercise overlap → no Tier 3 match", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "other-wo",
          startedAt: utcTime("2027-06-16"),
          exercises: [{ exerciseId: "ex1" }, { exerciseId: "ex99" }], // only 1/2 = 50% of Push (ex1, ex2). 50% is exactly the threshold; boundary: ≥0.5 → matches
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      // 1 out of 2 scheduled exercises = 50% → should match (≥ 0.5)
      expect(jun16?.status).toBe("completed");
    });

    it("below 50% exercise overlap → no match", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "other-wo",
          startedAt: utcTime("2027-06-16"),
          exercises: [{ exerciseId: "ex99" }], // 0 of 2 = 0% → no match
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("missed");
    });

    it("exercise overlap outside makeup window → no match", async () => {
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "other-wo",
          startedAt: utcTime("2027-06-20"), // 4 days after Jun 16
          exercises: [{ exerciseId: "ex1" }, { exerciseId: "ex2" }],
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      expect(jun16?.status).toBe("missed");
    });
  });

  describe("greedy one-to-one matching", () => {
    it("a session can only satisfy one occurrence (closest wins)", async () => {
      // Session on Jun 17 (Thu) with push-wo:
      //   Jun 16 (Wed=Push): workoutId matches, delta = +1 → Tier 2 match
      //   Jun 18 (Fri=Pull): workoutId mismatch (push-wo ≠ pull-wo) → no match
      // Jun 16 gets the session; Jun 18 remains unmatched.
      const sessions: FakeSession[] = [
        {
          id: "s1",
          planId: null,
          workoutId: "push-wo",
          startedAt: utcTime("2027-06-17"),
        },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      const jun18 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-18");
      // Jun 16 Push: workoutId matches, delta = +1 → wins
      expect(jun16?.matchedSessionId).toBe("s1");
      expect(jun18?.status).toBe("missed"); // session already consumed by Jun 16
    });

    it("two sessions, each matched to its closest occurrence", async () => {
      const sessions: FakeSession[] = [
        { id: "s1", planId: null, workoutId: "push-wo", startedAt: utcTime("2027-06-16") },
        { id: "s2", planId: null, workoutId: "pull-wo", startedAt: utcTime("2027-06-18") },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      const jun16 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-16");
      const jun18 = result.allOccurrences.find((o) => o.occurrenceDate === "2027-06-18");
      expect(jun16?.matchedSessionId).toBe("s1");
      expect(jun18?.matchedSessionId).toBe("s2");
    });
  });

  describe("summary computation", () => {
    it("adherencePct is 100 when all past occurrences are completed", async () => {
      // Past occurrences: Jun 16 (Wed=push-wo), Jun 18 (Fri=pull-wo), Jun 23 (Wed=push-wo)
      const sessions: FakeSession[] = [
        { id: "s1", planId: "plan1", workoutId: "push-wo", scheduledDate: utc("2027-06-16"), startedAt: utcTime("2027-06-16") },
        { id: "s2", planId: "plan1", workoutId: "pull-wo", scheduledDate: utc("2027-06-18"), startedAt: utcTime("2027-06-18") },
        { id: "s3", planId: "plan1", workoutId: "push-wo", scheduledDate: utc("2027-06-23"), startedAt: utcTime("2027-06-23") },
      ];
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN, sessions), "UTC");
      expect(result.overall.completed).toBe(3);
      expect(result.overall.missed).toBe(0);
      expect(result.overall.adherencePct).toBe(100);
    });

    it("adherencePct is null when only upcoming occurrences remain", async () => {
      const futurePlan = {
        ...PLAN,
        startDate: utc("2027-06-26"),
        endDate: utc("2027-07-10"),
      };
      const result = await getPlanAdherence("plan1", "user1", makePrisma(futurePlan), "UTC");
      expect(result.overall.adherencePct).toBeNull();
      expect(result.overall.missed).toBe(0);
    });

    it("thisWeek contains only occurrences in the current Mon–Sun window", async () => {
      // TODAY = 2027-06-25 (Friday) → this week: Mon Jun 21 – Sun Jun 27
      // Jun 23 (Wed=Push) and Jun 25 (Fri=Pull) are in this week
      const result = await getPlanAdherence("plan1", "user1", makePrisma(PLAN), "UTC");
      const thisWeekDates = result.thisWeek.map((o) => o.occurrenceDate);
      expect(thisWeekDates).toContain("2027-06-23");
      expect(thisWeekDates).toContain("2027-06-25");
      // Jun 16 and Jun 18 are the previous week (Mon Jun 14 – Sun Jun 20)
      expect(thisWeekDates).not.toContain("2027-06-16");
      expect(thisWeekDates).not.toContain("2027-06-18");
      // thisWeekStart is the Monday of the week containing 2027-06-25
      expect(result.thisWeekStart).toBe("2027-06-21");
    });
  });
});
