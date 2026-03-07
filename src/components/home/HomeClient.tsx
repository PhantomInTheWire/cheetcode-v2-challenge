"use client";

import { useState, useSyncExternalStore, type Dispatch, type SetStateAction } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { TOTAL_SOLVE_TARGET } from "@/lib/game/gameTypes";
import { isClientDevMode } from "@/lib/config/env";
import { useHomeGameState } from "@/hooks/useHomeGameState";
import { useSessionReplay } from "@/hooks/useSessionReplay";
import { postSessionReplayEvent } from "@/lib/session/session-replay-client";
import { GameLoadingScreen } from "@/components/game/GameLoadingScreen";

type LeaderboardRow = { github: string; elo: number; solved: number; timeSecs: number };
type AuthStatus = ReturnType<typeof useSession>["status"];

type HomeClientProps = {
  initialAuthStatus: AuthStatus;
  initialGithub: string;
  initialLeaderboard: LeaderboardRow[];
  initialUnlockedLevel: number;
};

const MOBILE_BREAKPOINT = 900;
const LandingScreen = dynamic(
  () => import("@/components/game/LandingScreen").then((m) => m.LandingScreen),
  {
    loading: () => <GameLoadingScreen label="Preparing homepage" />,
  },
);
const Level1Game = dynamic(() => import("@/components/game/Level1Game").then((m) => m.Level1Game), {
  loading: () => <GameLoadingScreen label="Loading level 1" />,
});
const Level2Game = dynamic(
  () => import("@/components/game/level2/Level2Game").then((m) => m.Level2Game),
  {
    loading: () => <GameLoadingScreen label="Loading level 2" />,
  },
);
const Level3Game = dynamic(
  () => import("@/components/game/level3/Level3Game").then((m) => m.Level3Game),
  {
    loading: () => <GameLoadingScreen label="Loading level 3" />,
  },
);
const Level2PrereqScreen = dynamic(
  () => import("@/components/game/prereq/Level2PrereqScreen").then((m) => m.Level2PrereqScreen),
  {
    loading: () => <GameLoadingScreen label="Preparing level 2 briefing" />,
  },
);
const Level3PrereqScreen = dynamic(
  () => import("@/components/game/prereq/Level3PrereqScreen").then((m) => m.Level3PrereqScreen),
  {
    loading: () => <GameLoadingScreen label="Preparing level 3 briefing" />,
  },
);
const MobileGateScreen = dynamic(
  () => import("@/components/game/MobileGateScreen").then((m) => m.MobileGateScreen),
  {
    loading: () => <GameLoadingScreen label="Checking device support" />,
  },
);
const RestoreScreen = dynamic(
  () => import("@/components/game/RestoreScreen").then((m) => m.RestoreScreen),
  {
    loading: () => <GameLoadingScreen label="Restoring session" />,
  },
);
const ResultsScreen = dynamic(
  () => import("@/components/game/results/ResultsScreen").then((m) => m.ResultsScreen),
  {
    loading: () => <GameLoadingScreen label="Assembling results" />,
  },
);

export function HomeClient(props: HomeClientProps) {
  return <HomeClientController {...props} />;
}
const Level3VerificationScreen = dynamic(
  () =>
    import("@/components/game/Level3VerificationScreen").then((m) => m.Level3VerificationScreen),
  {
    loading: () => <GameLoadingScreen label="Verifying final run" />,
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

function reportReplayLoggingFailure(error: unknown): void {
  console.error("[session-replay] completion logging failed", error);
}

function renderPlayingScreen(params: {
  github: string;
  canAutoSolve: boolean;
  sessionId: HomeGameState["sessionId"];
  startedAt: HomeGameState["startedAt"];
  expiresAt: HomeGameState["expiresAt"];
  currentLevel: HomeGameState["currentLevel"];
  l2Problems: HomeGameState["l2Problems"];
  l2Answers: HomeGameState["l2Answers"];
  setL2Answers: HomeGameState["setL2Answers"];
  l3Challenge: HomeGameState["l3Challenge"];
  l3CodeDraft: HomeGameState["l3CodeDraft"];
  setL3CodeDraft: HomeGameState["setL3CodeDraft"];
  activeScoreSnapshot: HomeGameState["activeScoreSnapshot"];
  updateRunScoreSnapshot: HomeGameState["updateRunScoreSnapshot"];
  updateActiveSessionExpiry: HomeGameState["updateActiveSessionExpiry"];
  clearStoredSession: HomeGameState["clearStoredSession"];
  clearActiveSessionRuntime: HomeGameState["clearActiveSessionRuntime"];
  setPendingLevel: HomeGameState["setPendingLevel"];
  persistFlowScreen: HomeGameState["persistFlowScreen"];
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
    if (params.currentLevel === 2 && nextResults?.completedLevel === true) {
      if (params.sessionId) {
        void postSessionReplayEvent({
          sessionId: params.sessionId,
          level: 2,
          eventType: "session_completed",
          screen: "playing",
          summary: {
            github: params.github,
            screen: "playing",
            level: 2,
            expiresAt: params.expiresAt,
            completedLevel: true,
            totalProblems: params.l2Problems.length,
            draftCount: Object.values(params.l2Answers).filter((value) => value.trim().length > 0)
              .length,
          },
          snapshot: {
            type: "level2",
            problems: params.l2Problems.map((problem) => ({
              id: problem.id,
              project: problem.project,
              question: problem.question,
            })),
            answers: params.l2Answers,
          },
        }).catch(reportReplayLoggingFailure);
      }
      params.updateRunScoreSnapshot(nextResults.scoreSnapshot ?? null);
      params.clearStoredSession();
      params.clearActiveSessionRuntime();
      params.setResults(null);
      params.setPendingLevel(3);
      params.persistFlowScreen("level3-prereq", 3);
      params.setScreen("level3-prereq");
      return;
    }

    params.clearStoredSession();
    params.setResults(nextResults);
    if (params.currentLevel === 3) {
      params.setScreen(nextResults.validation ? "level3-verification" : "results");
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
        scoreSnapshot={params.activeScoreSnapshot}
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
        startedAt={params.startedAt}
        expiresAt={params.expiresAt}
        scoreSnapshot={params.activeScoreSnapshot}
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
  persistFlowScreen: HomeGameState["persistFlowScreen"];
  setPendingLevel: HomeGameState["setPendingLevel"];
  setScreen: HomeGameState["setScreen"];
  level3Preview: HomeGameState["level3Preview"];
  level2Preview: HomeGameState["level2Preview"];
  level2PreviewLoading: HomeGameState["level2PreviewLoading"];
  level2PreviewError: HomeGameState["level2PreviewError"];
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
  startedAt: HomeGameState["startedAt"];
  expiresAt: HomeGameState["expiresAt"];
  l2Problems: HomeGameState["l2Problems"];
  l2Answers: HomeGameState["l2Answers"];
  setL2Answers: HomeGameState["setL2Answers"];
  l3Challenge: HomeGameState["l3Challenge"];
  l3CodeDraft: HomeGameState["l3CodeDraft"];
  setL3CodeDraft: HomeGameState["setL3CodeDraft"];
  activeScoreSnapshot: HomeGameState["activeScoreSnapshot"];
  updateRunScoreSnapshot: HomeGameState["updateRunScoreSnapshot"];
  updateActiveSessionExpiry: HomeGameState["updateActiveSessionExpiry"];
  clearStoredSession: HomeGameState["clearStoredSession"];
  clearActiveSessionRuntime: HomeGameState["clearActiveSessionRuntime"];
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
      startedAt: params.startedAt,
      expiresAt: params.expiresAt,
      currentLevel: params.currentLevel,
      l2Problems: params.l2Problems,
      l2Answers: params.l2Answers,
      setL2Answers: params.setL2Answers,
      l3Challenge: params.l3Challenge,
      l3CodeDraft: params.l3CodeDraft,
      setL3CodeDraft: params.setL3CodeDraft,
      activeScoreSnapshot: params.activeScoreSnapshot,
      updateRunScoreSnapshot: params.updateRunScoreSnapshot,
      updateActiveSessionExpiry: params.updateActiveSessionExpiry,
      clearStoredSession: params.clearStoredSession,
      clearActiveSessionRuntime: params.clearActiveSessionRuntime,
      setPendingLevel: params.setPendingLevel,
      persistFlowScreen: params.persistFlowScreen,
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
        level2Preview={params.level2Preview}
        level2PreviewLoading={params.level2PreviewLoading}
        level2PreviewError={params.level2PreviewError}
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

  if (params.screen === "results" && params.results) {
    return (
      <ResultsScreen
        results={params.results}
        displayedSolveTarget={params.sessionSolveTarget}
        currentLevel={params.currentLevel}
        unlockedLevel={params.unlockedLevel}
        isLocalDev={params.isLocalDev}
        github={params.github}
        email={params.email}
        setEmailAction={params.setEmail}
        xHandle={params.xHandle}
        setXHandleAction={params.setXHandle}
        flag={params.flag}
        setFlagAction={params.setFlag}
        emailError={params.emailError}
        setEmailErrorAction={params.setEmailError}
        xHandleError={params.xHandleError}
        setXHandleErrorAction={params.setXHandleError}
        submitError={params.submitError}
        submittedLead={params.submittedLead}
        submitLeadFormAction={params.submitLeadForm}
        shareScoreAction={params.shareScore}
        resetAllAction={params.resetAll}
        startGameAction={params.startGame}
      />
    );
  }

  return null;
}

function HomeClientController({
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
    level2Preview,
    level2PreviewLoading,
    level2PreviewError,
    level3Preview,
    level3PreviewLoading,
    level3PreviewError,
    isRestoringSession,
    didBootstrapSession,
    hasStoredActiveSession,
    sessionId,
    startedAt,
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
    activeScoreSnapshot,
    updateRunScoreSnapshot,
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
    clearActiveSessionRuntime,
    clearStoredFlowScreen,
    persistFlowScreen,
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

  useSessionReplay({
    github,
    isAuthenticated,
    sessionId,
    currentLevel,
    screen,
    expiresAt,
    problems,
    codes,
    localPass,
    l2Problems,
    l2Answers,
    l3Challenge,
    l3CodeDraft,
    results,
    isSubmitting,
    isRestoringSession,
    submitError,
    submittedLead,
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
    persistFlowScreen,
    setPendingLevel,
    setScreen,
    level2Preview,
    level2PreviewLoading,
    level2PreviewError,
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
    startedAt,
    expiresAt,
    l2Problems,
    l2Answers,
    setL2Answers,
    l3Challenge,
    l3CodeDraft,
    setL3CodeDraft,
    activeScoreSnapshot,
    updateRunScoreSnapshot,
    updateActiveSessionExpiry,
    clearStoredSession,
    clearActiveSessionRuntime,
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
