"use client";

import { SessionProvider } from "next-auth/react";
import { ReactNode } from "react";

/** Wraps the app in NextAuth's SessionProvider for useSession() access */
export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider
      // Avoid noisy /api/auth/session traffic on every window/tab focus in dev.
      refetchOnWindowFocus={false}
      refetchInterval={0}
      refetchWhenOffline={false}
    >
      {children}
    </SessionProvider>
  );
}
