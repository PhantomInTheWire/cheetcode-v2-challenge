import { ConvexHttpClient } from "convex/browser";
import { api } from "../../../convex/_generated/api";
import { HomeClient } from "@/components/HomeClient";
import { ENV } from "@/lib/env-vars";
import { auth } from "../../../auth";

export default async function HomePage() {
  const session = await auth();
  const initialGithub = (session?.user as { githubUsername?: string } | undefined)?.githubUsername ?? "";
  const initialAuthStatus = initialGithub ? "authenticated" : "unauthenticated";

  let initialLeaderboard: Array<{ github: string; elo: number; solved: number; timeSecs: number }> =
    [];
  let initialUnlockedLevel = 1;

  try {
    const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
    initialLeaderboard = (await convex.query(api.leaderboard.getAll)) ?? [];
    if (initialGithub) {
      initialUnlockedLevel = (await convex.query(api.leaderboard.getMyLevel, { github: initialGithub })) ?? 1;
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
