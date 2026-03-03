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

  if (isMobile) {
    return (
      <MobileGateScreen
        leaderboard={leaderboard}
        totalSolveTarget={TOTAL_SOLVE_TARGET}
        displayedSolveTarget={displayedSolveTarget}
      />
    );
  }

  if (
    !didBootstrapSession ||
    (hasStoredActiveSession && isRestoringSession && screen === "landing")
  ) {
    return <RestoreScreen />;
  }

  if (screen === "landing") {
    return (
      <LandingScreen
        isAuthenticated={isAuthenticated}
        github={github}
        authStatus={authStatus}
        authSession={authSession}
        showLeaderboard={showLeaderboard}
        setShowLeaderboard={setShowLeaderboard}
        unlockedLevel={unlockedLevel}
        isLocalDev={isLocalDev}
        startGame={startGame}
        leaderboard={leaderboard}
        TOTAL_SOLVE_TARGET={TOTAL_SOLVE_TARGET}
        displayedSolveTarget={displayedSolveTarget}
        submitError={submitError}
      />
    );
  }

  if (screen === "playing") {
    if (currentLevel === 2) {
      return (
        <Level2Game
          sessionId={sessionId!}
          github={github}
          problems={l2Problems}
          expiresAt={expiresAt}
          initialAnswers={l2Answers}
          onAnswersChange={setL2Answers}
          onFinishAction={(nextResults) => {
            clearStoredSession();
            setResults(nextResults);
            setScreen("results");
          }}
        />
      );
    }

    if (currentLevel === 3 && l3Challenge) {
      return (
        <Level3Game
          sessionId={sessionId!}
          github={github}
          challenge={l3Challenge}
          expiresAt={expiresAt}
          initialCode={l3CodeDraft}
          onCodeChange={setL3CodeDraft}
          onFinishAction={(nextResults) => {
            clearStoredSession();
            setResults(nextResults);
            setScreen("results");
          }}
        />
      );
    }

    const timerBg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";
    const timerFg = secondsLeft <= 10 ? "#dc2626" : secondsLeft <= 20 ? "#fa5d19" : "#1a9338";

    return (
      <Level1Game
        github={github}
        canAutoSolve={canAutoSolve}
        autoSolve={autoSolve}
        isAutoSolving={isAutoSolving}
        solvedLocal={solvedLocal}
        progress={progress}
        timerBg={timerBg}
        timerFg={timerFg}
        timeUp={timeUp}
        secondsLeft={secondsLeft}
        finishGame={finishGame}
        isSubmitting={isSubmitting}
        submitError={submitError}
        problems={problems}
        localPass={localPass}
        codes={codes}
        setCodes={setCodes}
        runLocalCheck={runLocalCheck}
      />
    );
  }

  if (screen === "level2-prereq") {
    return (
      <Level2PrereqScreen
        pendingLevel={pendingLevel}
        onCopy={copyToClipboard}
        onStart={launchLevel}
        onBack={() => {
          clearStoredFlowScreen();
          setPendingLevel(null);
          setScreen("landing");
        }}
      />
    );
  }

  if (screen === "level3-prereq") {
    const compilerCommand =
      level3Preview?.language === "Rust"
        ? "rustc --version"
        : level3Preview?.language === "C++"
          ? "c++ --version"
          : level3Preview?.language === "C"
            ? "cc --version"
            : "cc --version\nc++ --version\nrustc --version";

    return (
      <Level3PrereqScreen
        pendingLevel={pendingLevel}
        level3Preview={level3Preview}
        level3PreviewLoading={level3PreviewLoading}
        level3PreviewError={level3PreviewError}
        compilerCommand={compilerCommand}
        onCopy={copyToClipboard}
        onStart={launchLevel}
        onBack={() => {
          clearStoredFlowScreen();
          setPendingLevel(null);
          setScreen("landing");
        }}
      />
    );
  }

  if (results) {
    return (
      <ResultsScreen
        results={results}
        displayedSolveTarget={sessionSolveTarget}
        currentLevel={currentLevel}
        github={github}
        email={email}
        setEmail={setEmail}
        xHandle={xHandle}
        setXHandle={setXHandle}
        flag={flag}
        setFlag={setFlag}
        emailError={emailError}
        setEmailError={setEmailError}
        xHandleError={xHandleError}
        setXHandleError={setXHandleError}
        submitError={submitError}
        submittedLead={submittedLead}
        submitLeadForm={submitLeadForm}
        shareScore={shareScore}
        resetAll={resetAll}
        startGame={startGame}
      />
    );
  }

  return null;
}
