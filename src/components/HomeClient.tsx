"use client";

import { HomeClientController } from "@/components/HomeClientController";

type LeaderboardRow = { github: string; elo: number; solved: number; timeSecs: number };
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type HomeClientProps = {
  initialAuthStatus: AuthStatus;
  initialGithub: string;
  initialLeaderboard: LeaderboardRow[];
  initialUnlockedLevel: number;
};

export function HomeClient(props: HomeClientProps) {
  return <HomeClientController {...props} />;
}
