import { prisma } from "@/lib/db";
import { getMuscleRecentVolume } from "@/lib/analytics/muscle-recent";
import { BodyMap } from "@/components/ui/body-map";

export async function MuscleMapOverview({ userId }: { userId: string }) {
  const muscleCounts = await getMuscleRecentVolume(userId, prisma, 7);
  const hasData = Object.values(muscleCounts).some((v) => v && v > 0);

  if (!hasData) {
    return (
      <p className="py-4 text-center text-sm text-muted-foreground">
        Log sessions in the past 7 days to see muscles worked.
      </p>
    );
  }

  return <BodyMap muscleIntensity={muscleCounts} />;
}
