"use client";

import { useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import dynamic from "next/dynamic";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { LandingScreen } from "@/components/game/LandingScreen";
import { Level1Game } from "@/components/game/Level1Game";
import { Level2PrereqScreen } from "@/components/game/Level2PrereqScreen";
import { Level3PrereqScreen } from "@/components/game/Level3PrereqScreen";
import { MobileGateScreen } from "@/components/game/MobileGateScreen";
import { RestoreScreen } from "@/components/game/RestoreScreen";
import { ResultsScreen } from "@/components/game/ResultsScreen";
import { TOTAL_SOLVE_TARGET } from "@/lib/gameTypes";
import { isClientDevMode } from "@/lib/myEnv";
import { useHomeGameState } from "@/hooks/useHomeGameState";

const MOBILE_BREAKPOINT = 900;
const Level2Game = dynamic(() => import("@/components/Level2Game").then((m) => m.Level2Game));
const Level3Game = dynamic(() => import("@/components/Level3Game").then((m) => m.Level3Game));

function useIsMobile() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
      mql.addEventListener("change", onStoreChange);
      return () => mql.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`).matches,
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
  clearStoredSession: HomeGameState["clearStoredSession"];
  setResults: HomeGameState["setResults"];
  setScreen: HomeGameState["setScreen"];
  autoSolve: HomeGameState["autoSolve"];
  isAutoSolving: HomeGameState["isAutoSolving"];
  solvedLocal: HomeGameState["solvedLocal"];
  progress: HomeGameState["progress"];
  timeUp: HomeGameState["timeUp"];
  secondsLeft: HomeGameState["secondsLeft"];
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
    params.setScreen("results");
  };

  if (params.currentLevel === 2) {
    return (
      <Level2Game
        sessionId={params.sessionId!}
        github={params.github}
        problems={params.l2Problems}
        expiresAt={params.expiresAt}
        initialAnswers={params.l2Answers}
        onAnswersChange={params.setL2Answers}
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
        onCodeChange={params.setL3CodeDraft}
        onFinishAction={finishAndShowResults}
      />
    );
  }

  const timerBg =
    params.secondsLeft <= 10 ? "#dc2626" : params.secondsLeft <= 20 ? "#fa5d19" : "#1a9338";

  return (
    <Level1Game
      github={params.github}
      canAutoSolve={params.canAutoSolve}
      autoSolve={params.autoSolve}
      isAutoSolving={params.isAutoSolving}
      solvedLocal={params.solvedLocal}
      progress={params.progress}
      timerBg={timerBg}
      timerFg={timerBg}
      timeUp={params.timeUp}
      secondsLeft={params.secondsLeft}
      finishGame={params.finishGame}
      isSubmitting={params.isSubmitting}
      submitError={params.submitError}
      problems={params.problems}
      localPass={params.localPass}
      codes={params.codes}
      setCodes={params.setCodes}
      runLocalCheck={params.runLocalCheck}
    />
  );
}

function renderHomeScreen(params: {
  isMobile: boolean;
  leaderboard: ReturnType<typeof useQuery<typeof api.leaderboard.getAll>> extends infer T
    ? Exclude<T, undefined>
    : never;
  displayedSolveTarget: HomeGameState["displayedSolveTarget"];
  didBootstrapSession: HomeGameState["didBootstrapSession"];
  hasStoredActiveSession: HomeGameState["hasStoredActiveSession"];
  isRestoringSession: HomeGameState["isRestoringSession"];
  screen: HomeGameState["screen"];
  isAuthenticated: boolean;
  github: string;
  authStatus: ReturnType<typeof useSession>["status"];
  authSession: ReturnType<typeof useSession>["data"];
  showLeaderboard: HomeGameState["showLeaderboard"];
  setShowLeaderboard: HomeGameState["setShowLeaderboard"];
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
  clearStoredSession: HomeGameState["clearStoredSession"];
  setResults: HomeGameState["setResults"];
  autoSolve: HomeGameState["autoSolve"];
  isAutoSolving: HomeGameState["isAutoSolving"];
  solvedLocal: HomeGameState["solvedLocal"];
  progress: HomeGameState["progress"];
  timeUp: HomeGameState["timeUp"];
  secondsLeft: HomeGameState["secondsLeft"];
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
      clearStoredSession: params.clearStoredSession,
      setResults: params.setResults,
      setScreen: params.setScreen,
      autoSolve: params.autoSolve,
      isAutoSolving: params.isAutoSolving,
      solvedLocal: params.solvedLocal,
      progress: params.progress,
      timeUp: params.timeUp,
      secondsLeft: params.secondsLeft,
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

export default function Home() {
  const { data: authSession, status: authStatus } = useSession();
  const github = authSession?.user?.githubUsername ?? "";
  const isAuthenticated = authStatus === "authenticated" && !!github;
  const leaderboardQuery = useQuery(api.leaderboard.getAll);
  const leaderboard = leaderboardQuery ?? [];
  const unlockedLevel = useQuery(api.leaderboard.getMyLevel, { github: github || "" }) ?? 1;
  const isLocalDev = isClientDevMode();
  const canAutoSolve = isClientDevMode();
  const isMobile = useIsMobile();

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
    showLeaderboard,
    setShowLeaderboard,
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
    solvedLocal,
    progress,
    timeUp,
    secondsLeft,
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
    authStatus,
    isAuthenticated,
    leaderboard,
    unlockedLevel,
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
    authStatus,
    authSession,
    showLeaderboard,
    setShowLeaderboard,
    unlockedLevel,
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
    clearStoredSession,
    setResults,
    autoSolve,
    isAutoSolving,
    solvedLocal,
    progress,
    timeUp,
    secondsLeft,
    finishGame,
    isSubmitting,
    problems,
    localPass,
    codes,
    setCodes,
    runLocalCheck,
  });
}
