"use client";

import dynamic from "next/dynamic";

type LeaderboardRow = { github: string; elo: number; solved: number; timeSecs: number };
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export type HomeClientProps = {
  initialAuthStatus: AuthStatus;
  initialGithub: string;
  initialLeaderboard: LeaderboardRow[];
  initialUnlockedLevel: number;
};

const HomeClientController = dynamic(
  () => import("@/components/HomeClientController").then((m) => m.HomeClientController),
  {
    loading: () => (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#f9f9f9",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          color: "rgba(0,0,0,0.35)",
          fontSize: 14,
        }}
      >
        Loading...
      </div>
    ),
  },
);

export function HomeClient(props: HomeClientProps) {
  return <HomeClientController {...props} />;
}
