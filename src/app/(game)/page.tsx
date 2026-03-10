import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { HomeClient } from "@/components/HomeClient";
import { ENV } from "@/lib/env-vars";
import { getServerSession } from "@/lib/session/server-session";

export default async function HomePage() {
  const session = await getServerSession();
  const initialGithub =
    (session?.user as { githubUsername?: string } | undefined)?.githubUsername ?? "";
  const initialAuthStatus = initialGithub ? "authenticated" : "unauthenticated";

  let initialLeaderboard: Array<{ github: string; elo: number; solved: number; timeSecs: number }> =
    [];
  let initialUnlockedLevel = 1;

  try {
    const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
    const [leaderboardResult, unlockedLevelResult] = await Promise.allSettled([
      convex.query(api.leaderboard.getAll),
      initialGithub ? convex.query(api.leaderboard.getMyLevel, { github: initialGithub }) : 1,
    ]);

    if (leaderboardResult.status === "fulfilled") {
      initialLeaderboard = leaderboardResult.value ?? [];
    } else {
      console.error("Failed to preload leaderboard:", leaderboardResult.reason);
    }

    if (unlockedLevelResult.status === "fulfilled") {
      initialUnlockedLevel = unlockedLevelResult.value ?? 1;
    } else {
      console.error("Failed to preload unlocked level:", unlockedLevelResult.reason);
    }
  } catch (error) {
    console.error("Failed to preload game bootstrap data:", error);
  }

  return (
    <HomeClient
      initialAuthStatus={initialAuthStatus}
      initialGithub={initialGithub}
      initialLeaderboard={initialLeaderboard}
      initialUnlockedLevel={initialUnlockedLevel}
    />
  );
}
