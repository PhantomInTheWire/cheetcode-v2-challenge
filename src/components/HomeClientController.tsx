"use client";

import { useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { TOTAL_SOLVE_TARGET } from "@/lib/gameTypes";
import { isClientDevMode } from "@/lib/myEnv";
import { useHomeGameState } from "@/hooks/useHomeGameState";
import type { HomeClientProps } from "@/components/HomeClient";

const MOBILE_BREAKPOINT = 900;
const LandingScreen = dynamic(
  () => import("@/components/game/LandingScreen").then((m) => m.LandingScreen),
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
const Level1Game = dynamic(() => import("@/components/game/Level1Game").then((m) => m.Level1Game), {
  loading: () => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</div>
  ),
});
const Level2Game = dynamic(() => import("@/components/Level2Game").then((m) => m.Level2Game), {
  loading: () => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</div>
  ),
});
const Level3Game = dynamic(() => import("@/components/Level3Game").then((m) => m.Level3Game), {
  loading: () => (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center" }}>Loading...</div>
  ),
});
const Level2PrereqScreen = dynamic(
  () => import("@/components/game/Level2PrereqScreen").then((m) => m.Level2PrereqScreen),
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
const Level3PrereqScreen = dynamic(
  () => import("@/components/game/Level3PrereqScreen").then((m) => m.Level3PrereqScreen),
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
const MobileGateScreen = dynamic(
  () => import("@/components/game/MobileGateScreen").then((m) => m.MobileGateScreen),
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
const RestoreScreen = dynamic(
  () => import("@/components/game/RestoreScreen").then((m) => m.RestoreScreen),
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
const ResultsScreen = dynamic(
  () => import("@/components/game/ResultsScreen").then((m) => m.ResultsScreen),
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
const Level3VerificationScreen = dynamic(
  () =>
    import("@/components/game/Level3VerificationScreen").then((m) => m.Level3VerificationScreen),
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

function useIsMobile() {
  const query = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;
  const mediaQueryList = typeof window !== "undefined" ? window.matchMedia(query) : null;

  return useSyncExternalStore(
    (onStoreChange) => {
      if (!mediaQueryList) return () => {};
      mediaQueryList.addEventListener("change", onStoreChange);
      return () => mediaQueryList.removeEventListener("change", onStoreChange);
    },
    () => mediaQueryList?.matches ?? false,
    () => false,
  );
}

function useHasHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

type HomeGameState = ReturnType<typeof useHomeGameState>;
type LeaderboardRow = { github: string; elo: number; solved: number; timeSecs: number };
type AuthStatus = ReturnType<typeof useSession>["status"];

function goBackToLanding(
  clearStoredFlowScreen: HomeGameState["clearStoredFlowScreen"],
  setPendingLevel: HomeGameState["setPendingLevel"],
  setScreen: HomeGameState["setScreen"],
): void {
  clearStoredFlowScreen();
  setPendingLevel(null);
  setScreen("landing");
}

function getCompilerCommand(language: string | undefined): string {
  if (language === "Rust") return "rustc --version";
  if (language === "C++") return "c++ --version";
  if (language === "C") return "cc --version";
  return "cc --version\nc++ --version\nrustc --version";
}

function renderPlayingScreen(params: {
  github: string;
  canAutoSolve: boolean;
  sessionId: HomeGameState["sessionId"];
  expiresAt: HomeGameState["expiresAt"];
  currentLevel: HomeGameState["currentLevel"];
  l2Problems: HomeGameState["l2Problems"];
  l2Answers: HomeGameState["l2Answers"];
  setL2Answers: HomeGameState["setL2Answers"];
  l3Challenge: HomeGameState["l3Challenge"];
  l3CodeDraft: HomeGameState["l3CodeDraft"];
  setL3CodeDraft: HomeGameState["setL3CodeDraft"];
  updateActiveSessionExpiry: HomeGameState["updateActiveSessionExpiry"];
  clearStoredSession: HomeGameState["clearStoredSession"];
  setResults: HomeGameState["setResults"];
  setScreen: HomeGameState["setScreen"];
  autoSolve: HomeGameState["autoSolve"];
  isAutoSolving: HomeGameState["isAutoSolving"];
  solvedLocal: HomeGameState["solvedLocal"];
  finishGame: HomeGameState["finishGame"];
  isSubmitting: HomeGameState["isSubmitting"];
  submitError: HomeGameState["submitError"];
  problems: HomeGameState["problems"];
  localPass: HomeGameState["localPass"];
  codes: HomeGameState["codes"];
  setCodes: HomeGameState["setCodes"];
  runLocalCheck: HomeGameState["runLocalCheck"];
}) {
  const finishAndShowResults = (nextResults: HomeGameState["results"]) => {
    params.clearStoredSession();
    params.setResults(nextResults);
    if (params.currentLevel === 3) {
      params.setScreen("level3-verification");
    } else {
      params.setScreen("results");
    }
  };

  if (params.currentLevel === 2) {
    return (
      <Level2Game
        sessionId={params.sessionId!}
        github={params.github}
        problems={params.l2Problems}
        expiresAt={params.expiresAt}
        initialAnswers={params.l2Answers}
        onAnswersChangeAction={params.setL2Answers}
        onFinishAction={finishAndShowResults}
      />
    );
  }

  if (params.currentLevel === 3 && params.l3Challenge) {
    return (
      <Level3Game
        sessionId={params.sessionId!}
        github={params.github}
        challenge={params.l3Challenge}
        expiresAt={params.expiresAt}
        initialCode={params.l3CodeDraft}
        onCodeChangeAction={params.setL3CodeDraft}
        onExpiresAtChangeAction={params.updateActiveSessionExpiry}
        onFinishAction={finishAndShowResults}
      />
    );
  }

  return (
    <Level1Game
      github={params.github}
      canAutoSolve={params.canAutoSolve}
      autoSolveAction={params.autoSolve}
      isAutoSolving={params.isAutoSolving}
      solvedLocal={params.solvedLocal}
      expiresAt={params.expiresAt}
      finishGameAction={params.finishGame}
      isSubmitting={params.isSubmitting}
      submitError={params.submitError}
      problems={params.problems}
      localPass={params.localPass}
      codes={params.codes}
      setCodesAction={params.setCodes}
      runLocalCheckAction={params.runLocalCheck}
    />
  );
}

function renderHomeScreen(params: {
  isMobile: boolean;
  leaderboard: LeaderboardRow[];
  displayedSolveTarget: HomeGameState["displayedSolveTarget"];
  didBootstrapSession: HomeGameState["didBootstrapSession"];
  hasStoredActiveSession: HomeGameState["hasStoredActiveSession"];
  isRestoringSession: HomeGameState["isRestoringSession"];
  screen: HomeGameState["screen"];
  isAuthenticated: boolean;
  github: string;
  authStatus: AuthStatus;
  authSession: ReturnType<typeof useSession>["data"];
  showLeaderboard: boolean;
  setShowLeaderboard: Dispatch<SetStateAction<boolean>>;
  unlockedLevel: number;
  isLocalDev: boolean;
  startGame: HomeGameState["startGame"];
  submitError: HomeGameState["submitError"];
  pendingLevel: HomeGameState["pendingLevel"];
  copyToClipboard: HomeGameState["copyToClipboard"];
  launchLevel: HomeGameState["launchLevel"];
  clearStoredFlowScreen: HomeGameState["clearStoredFlowScreen"];
  setPendingLevel: HomeGameState["setPendingLevel"];
  setScreen: HomeGameState["setScreen"];
  level3Preview: HomeGameState["level3Preview"];
  level3PreviewLoading: HomeGameState["level3PreviewLoading"];
  level3PreviewError: HomeGameState["level3PreviewError"];
  results: HomeGameState["results"];
  sessionSolveTarget: HomeGameState["sessionSolveTarget"];
  currentLevel: HomeGameState["currentLevel"];
  email: HomeGameState["email"];
  setEmail: HomeGameState["setEmail"];
  xHandle: HomeGameState["xHandle"];
  setXHandle: HomeGameState["setXHandle"];
  flag: HomeGameState["flag"];
  setFlag: HomeGameState["setFlag"];
  emailError: HomeGameState["emailError"];
  setEmailError: HomeGameState["setEmailError"];
  xHandleError: HomeGameState["xHandleError"];
  setXHandleError: HomeGameState["setXHandleError"];
  submittedLead: HomeGameState["submittedLead"];
  submitLeadForm: HomeGameState["submitLeadForm"];
  shareScore: HomeGameState["shareScore"];
  resetAll: HomeGameState["resetAll"];
  canAutoSolve: boolean;
  sessionId: HomeGameState["sessionId"];
  expiresAt: HomeGameState["expiresAt"];
  l2Problems: HomeGameState["l2Problems"];
  l2Answers: HomeGameState["l2Answers"];
  setL2Answers: HomeGameState["setL2Answers"];
  l3Challenge: HomeGameState["l3Challenge"];
  l3CodeDraft: HomeGameState["l3CodeDraft"];
  setL3CodeDraft: HomeGameState["setL3CodeDraft"];
  updateActiveSessionExpiry: HomeGameState["updateActiveSessionExpiry"];
  clearStoredSession: HomeGameState["clearStoredSession"];
  setResults: HomeGameState["setResults"];
  autoSolve: HomeGameState["autoSolve"];
  isAutoSolving: HomeGameState["isAutoSolving"];
  solvedLocal: HomeGameState["solvedLocal"];
  finishGame: HomeGameState["finishGame"];
  isSubmitting: HomeGameState["isSubmitting"];
  problems: HomeGameState["problems"];
  localPass: HomeGameState["localPass"];
  codes: HomeGameState["codes"];
  setCodes: HomeGameState["setCodes"];
  runLocalCheck: HomeGameState["runLocalCheck"];
}) {
  if (params.isMobile) {
    return (
      <MobileGateScreen
        leaderboard={params.leaderboard}
        totalSolveTarget={TOTAL_SOLVE_TARGET}
        displayedSolveTarget={params.displayedSolveTarget}
      />
    );
  }

  if (
    !params.didBootstrapSession ||
    (params.hasStoredActiveSession && params.isRestoringSession && params.screen === "landing")
  ) {
    return <RestoreScreen />;
  }

  if (params.screen === "landing") {
    return (
      <LandingScreen
        isAuthenticated={params.isAuthenticated}
        github={params.github}
        authStatus={params.authStatus}
        authSession={params.authSession}
        showLeaderboard={params.showLeaderboard}
        setShowLeaderboard={params.setShowLeaderboard}
        unlockedLevel={params.unlockedLevel}
        isLocalDev={params.isLocalDev}
        startGame={params.startGame}
        leaderboard={params.leaderboard}
        TOTAL_SOLVE_TARGET={TOTAL_SOLVE_TARGET}
        displayedSolveTarget={params.displayedSolveTarget}
        submitError={params.submitError}
      />
    );
  }

  if (params.screen === "playing") {
    return renderPlayingScreen({
      github: params.github,
      canAutoSolve: params.canAutoSolve,
      sessionId: params.sessionId,
      expiresAt: params.expiresAt,
      currentLevel: params.currentLevel,
      l2Problems: params.l2Problems,
      l2Answers: params.l2Answers,
      setL2Answers: params.setL2Answers,
      l3Challenge: params.l3Challenge,
      l3CodeDraft: params.l3CodeDraft,
      setL3CodeDraft: params.setL3CodeDraft,
      updateActiveSessionExpiry: params.updateActiveSessionExpiry,
      clearStoredSession: params.clearStoredSession,
      setResults: params.setResults,
      setScreen: params.setScreen,
      autoSolve: params.autoSolve,
      isAutoSolving: params.isAutoSolving,
      solvedLocal: params.solvedLocal,
      finishGame: params.finishGame,
      isSubmitting: params.isSubmitting,
      submitError: params.submitError,
      problems: params.problems,
      localPass: params.localPass,
      codes: params.codes,
      setCodes: params.setCodes,
      runLocalCheck: params.runLocalCheck,
    });
  }

  if (params.screen === "level2-prereq") {
    return (
      <Level2PrereqScreen
        pendingLevel={params.pendingLevel}
        onCopy={params.copyToClipboard}
        onStart={params.launchLevel}
        onBack={() =>
          goBackToLanding(params.clearStoredFlowScreen, params.setPendingLevel, params.setScreen)
        }
      />
    );
  }

  if (params.screen === "level3-prereq") {
    const compilerCommand = getCompilerCommand(params.level3Preview?.language);
    return (
      <Level3PrereqScreen
        pendingLevel={params.pendingLevel}
        level3Preview={params.level3Preview}
        level3PreviewLoading={params.level3PreviewLoading}
        level3PreviewError={params.level3PreviewError}
        compilerCommand={compilerCommand}
        onCopy={params.copyToClipboard}
        onStart={params.launchLevel}
        onBack={() =>
          goBackToLanding(params.clearStoredFlowScreen, params.setPendingLevel, params.setScreen)
        }
      />
    );
  }

  if (params.screen === "level3-verification" && params.results) {
    return (
      <Level3VerificationScreen
        results={params.results}
        onContinue={() => params.setScreen("results")}
      />
    );
  }

  if (params.results) {
    return (
      <ResultsScreen
        results={params.results}
        displayedSolveTarget={params.sessionSolveTarget}
        currentLevel={params.currentLevel}
        unlockedLevel={params.unlockedLevel}
        isLocalDev={params.isLocalDev}
        github={params.github}
        email={params.email}
        setEmail={params.setEmail}
        xHandle={params.xHandle}
        setXHandle={params.setXHandle}
        flag={params.flag}
        setFlag={params.setFlag}
        emailError={params.emailError}
        setEmailError={params.setEmailError}
        xHandleError={params.xHandleError}
        setXHandleError={params.setXHandleError}
        submitError={params.submitError}
        submittedLead={params.submittedLead}
        submitLeadForm={params.submitLeadForm}
        shareScore={params.shareScore}
        resetAll={params.resetAll}
        startGame={params.startGame}
      />
    );
  }

  return null;
}

export function HomeClientController({
  initialAuthStatus,
  initialGithub,
  initialLeaderboard,
  initialUnlockedLevel,
}: HomeClientProps) {
  const { data: authSession, status: authStatus } = useSession();
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const enableLiveQueries = useHasHydrated();
  const isMobile = useIsMobile();
  const github = authSession?.user?.githubUsername ?? initialGithub;
  const effectiveAuthStatus =
    authStatus === "loading" && initialAuthStatus !== "loading" ? initialAuthStatus : authStatus;
  const isAuthenticated = effectiveAuthStatus === "authenticated" && !!github;
  const shouldLoadLeaderboard = enableLiveQueries && (showLeaderboard || isMobile);
  const leaderboardQuery = useQuery(api.leaderboard.getAll, shouldLoadLeaderboard ? {} : "skip") as
    | LeaderboardRow[]
    | undefined;
  const leaderboard = leaderboardQuery ?? initialLeaderboard;
  const unlockedLevelQuery = useQuery(
    api.leaderboard.getMyLevel,
    enableLiveQueries && github ? { github } : "skip",
  );
  const effectiveUnlockedLevel = github
    ? (unlockedLevelQuery ?? initialUnlockedLevel)
    : initialUnlockedLevel;
  const isLocalDev = isClientDevMode();
  const canAutoSolve = isClientDevMode();

  const {
    screen,
    setScreen,
    pendingLevel,
    setPendingLevel,
    level3Preview,
    level3PreviewLoading,
    level3PreviewError,
    isRestoringSession,
    didBootstrapSession,
    hasStoredActiveSession,
    sessionId,
    expiresAt,
    problems,
    codes,
    setCodes,
    localPass,
    results,
    setResults,
    email,
    setEmail,
    xHandle,
    setXHandle,
    flag,
    setFlag,
    submittedLead,
    isAutoSolving,
    isSubmitting,
    submitError,
    emailError,
    setEmailError,
    xHandleError,
    setXHandleError,
    displayedSolveTarget,
    sessionSolveTarget,
    currentLevel,
    l2Problems,
    l2Answers,
    setL2Answers,
    l3Challenge,
    l3CodeDraft,
    setL3CodeDraft,
    updateActiveSessionExpiry,
    solvedLocal,
    finishGame,
    startGame,
    launchLevel,
    runLocalCheck,
    submitLeadForm,
    resetAll,
    shareScore,
    autoSolve,
    clearStoredSession,
    clearStoredFlowScreen,
    copyToClipboard,
  } = useHomeGameState({
    github,
    authStatus: effectiveAuthStatus,
    isAuthenticated,
    leaderboard,
    unlockedLevel: effectiveUnlockedLevel,
    isLocalDev,
    canAutoSolve,
  });

  return renderHomeScreen({
    isMobile,
    leaderboard,
    displayedSolveTarget,
    didBootstrapSession,
    hasStoredActiveSession,
    isRestoringSession,
    screen,
    isAuthenticated,
    github,
    authStatus: effectiveAuthStatus,
    authSession,
    showLeaderboard,
    setShowLeaderboard,
    unlockedLevel: effectiveUnlockedLevel,
    isLocalDev,
    startGame,
    submitError,
    pendingLevel,
    copyToClipboard,
    launchLevel,
    clearStoredFlowScreen,
    setPendingLevel,
    setScreen,
    level3Preview,
    level3PreviewLoading,
    level3PreviewError,
    results,
    sessionSolveTarget,
    currentLevel,
    email,
    setEmail,
    xHandle,
    setXHandle,
    flag,
    setFlag,
    emailError,
    setEmailError,
    xHandleError,
    setXHandleError,
    submittedLead,
    submitLeadForm,
    shareScore,
    resetAll,
    canAutoSolve,
    sessionId,
    expiresAt,
    l2Problems,
    l2Answers,
    setL2Answers,
    l3Challenge,
    l3CodeDraft,
    setL3CodeDraft,
    updateActiveSessionExpiry,
    clearStoredSession,
    setResults,
    autoSolve,
    isAutoSolving,
    solvedLocal,
    finishGame,
    isSubmitting,
    problems,
    localPass,
    codes,
    setCodes,
    runLocalCheck,
  });
}
