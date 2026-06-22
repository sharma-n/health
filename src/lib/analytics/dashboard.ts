import type { PrismaClient } from "@/generated/prisma/client";
import { getAdherenceStats } from "./adherence";
import { getPersonalRecords, type PersonalRecord } from "./prs";

export interface DashboardStats {
  currentStreak: number;
  sessionsThisWeek: number;
  sessionsLastWeek: number;
  totalCompleted: number;
  recentPRs: PersonalRecord[];
}

export async function getDashboardStats(
  userId: string,
  prisma: PrismaClient,
): Promise<DashboardStats> {
  const [adherence, allPRs] = await Promise.all([
    getAdherenceStats(userId, prisma),
    getPersonalRecords(userId, prisma),
  ]);

  const recentPRs = allPRs.filter((pr) => pr.isNew);

  return {
    currentStreak: adherence.currentStreak,
    sessionsThisWeek: adherence.sessionsThisWeek,
    sessionsLastWeek: adherence.sessionsLastWeek,
    totalCompleted: adherence.totalCompleted,
    recentPRs,
  };
}
