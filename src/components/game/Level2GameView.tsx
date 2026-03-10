"use client";

import { FIRECRAWL_FLAME_SVG } from "./firecrawl-flame";
import { BrailleSpinner } from "./decor";

export type Level2ProjectKey = "chromium" | "firefox" | "libreoffice" | "postgres";

export type Level2Problem = {
  id: string;
  question: string;
  project?: Level2ProjectKey;
};

export const LEVEL2_PROJECT_META: Record<
  Level2ProjectKey,
  { label: string; commit: string; color: string }
> = {
  chromium: {
    label: "Chromium",
    commit: "69c7c0a024",
    color: "#4285f4",
  },
  firefox: {
    label: "Firefox",
    commit: "22d04b52b0",
    color: "#ff7139",
  },
  libreoffice: {
    label: "LibreOffice",
    commit: "05aabfc2db",
    color: "#18a303",
  },
  postgres: {
    label: "PostgreSQL",
    commit: "f1baed18b",
    color: "#336791",
  },
};

export function inferProjectFromProblemId(problemId: string): Level2ProjectKey | null {
  if (problemId.startsWith("l2_")) return "chromium";
  if (problemId.startsWith("ff_")) return "firefox";
  if (problemId.startsWith("lo_")) return "libreoffice";
  if (problemId.startsWith("pg_")) return "postgres";
  return null;
}

type Level2GameViewProps = {
  github: string;
  canAutoSolve: boolean;
  isSubmitting: boolean;
  timeUp: boolean;
  submitError: string | null;
  solvedLocal: number;
  problems: Level2Problem[];
  answers: Record<string, string>;
  localCorrect: Record<string, boolean | null>;
  sessionProjects: Level2ProjectKey[];
  onAutoSolve: () => void;
  onFinishGame: () => void;
  onAnswerChange: (problemId: string, value: string) => void;
  onCheckAnswer: (problemId: string) => void;
  onDismissSubmitError: () => void;
};

type ProblemCardProps = {
  index: number;
  problem: Level2Problem;
  answer: string;
  status: boolean | null | undefined;
  timeUp: boolean;
  onAnswerChange: (value: string) => void;
  onCheck: () => void;
};

function ProblemCard({
  index,
  problem,
  answer,
  status,
  timeUp,
  onAnswerChange,
  onCheck,
}: ProblemCardProps) {
  const borderColor = status === true ? "#22c55e" : status === false ? "#ef4444" : "#e8e8e8";
  const backgroundColor = status === true ? "#f0fdf4" : status === false ? "#fef2f2" : "#ffffff";
  const projectKey = problem.project ?? inferProjectFromProblemId(problem.id);
  const meta = projectKey ? LEVEL2_PROJECT_META[projectKey] : null;
  const actionDisabled = timeUp || status === true || !answer.trim();

  return (
    <div
      style={{
        background: backgroundColor,
        border: `1px solid ${borderColor}`,
        borderRadius: 16,
        padding: 20,
        marginBottom: 16,
        transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        boxShadow: "0 1px 3px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
        <div style={{ flexShrink: 0, textAlign: "center" }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: meta?.color || "#fa5d19",
              fontFamily: "var(--font-geist-mono), monospace",
              marginBottom: 4,
            }}
          >
            {String(index + 1).padStart(2, "0")}
          </div>
          {meta && (
            <div
              title={meta.label}
              style={{
                width: 4,
                height: 24,
                borderRadius: 2,
                background: meta.color,
                margin: "0 auto",
              }}
            />
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 12,
            }}
          >
            {meta && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: meta.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                [ {meta.label}_SYSTEM ]
              </span>
            )}
            {status === true && (
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "#1a9338",
                  textTransform: "uppercase",
                }}
              >
                [ VERIFIED ]
              </span>
            )}
          </div>
          <p
            style={{
              fontSize: 14,
              color: "#262626",
              margin: "0 0 16px",
              lineHeight: 1.6,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {problem.question}
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={answer}
              onChange={(event) => onAnswerChange(event.target.value)}
              disabled={timeUp || status === true}
              placeholder="Type solution..."
              style={{
                flex: 1,
                height: 40,
                padding: "0 14px",
                fontSize: 13,
                fontFamily: "var(--font-geist-mono), monospace",
                border: "1px solid #e8e8e8",
                borderRadius: 10,
                background: status === true ? "#f0fdf4" : "#fafafa",
                color: status === true ? "#1a9338" : "#262626",
                outline: "none",
                transition: "all 0.2s",
              }}
              onFocus={(event) => {
                if (status !== true) event.target.style.borderColor = "#fa5d19";
              }}
              onBlur={(event) => {
                if (status !== true) event.target.style.borderColor = "#e8e8e8";
              }}
            />
            <button
              onClick={onCheck}
              disabled={actionDisabled}
              className={status === true ? "" : "btn-heat"}
              style={{
                height: 40,
                padding: "0 20px",
                borderRadius: 10,
                border: status === true ? "none" : undefined,
                fontSize: 13,
                fontWeight: 500,
                cursor: actionDisabled ? "not-allowed" : "pointer",
                background: status === true ? "rgba(26,147,56,0.08)" : undefined,
                color: status === true ? "#1a9338" : undefined,
              }}
            >
              {status === true
                ? "Pass"
                : status === false
                  ? "Retry"
                  : status === null
                    ? "..."
                    : "Check"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Level2StatusOverlay({
  isSubmitting,
  submitError,
  solvedLocal,
  onDismissSubmitError,
  onFinishGame,
}: Pick<
  Level2GameViewProps,
  "isSubmitting" | "submitError" | "solvedLocal" | "onDismissSubmitError" | "onFinishGame"
>) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
      }}
    >
      <div
        style={{
          textAlign: "center",
          background: "#ffffff",
          borderRadius: 24,
          padding: "48px 56px",
          border: "1px solid #e8e8e8",
          boxShadow: "0 24px 48px rgba(0,0,0,0.12)",
          maxWidth: 480,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <svg
            width="40"
            height="40"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
        </div>
        <p
          style={{
            fontSize: 40,
            fontWeight: 500,
            color: solvedLocal === 10 ? "#1a9338" : "#262626",
            margin: 0,
            lineHeight: 1.1,
            letterSpacing: -0.5,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {isSubmitting ? "Submitting..." : solvedLocal === 10 ? "All Clear" : "Time\u2019s Up"}
        </p>
        <p
          style={{
            fontSize: 16,
            color: "rgba(0,0,0,0.4)",
            margin: "12px 0 0",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {solvedLocal}/10 solved
        </p>
        {!isSubmitting && (
          <button
            onClick={onFinishGame}
            className="btn-heat"
            style={{
              marginTop: 28,
              padding: "12px 44px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            See Results
          </button>
        )}
        {isSubmitting && !submitError && (
          <div
            style={{
              fontSize: 13,
              color: "rgba(0,0,0,0.3)",
              marginTop: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <BrailleSpinner />
            <span>Synchronizing Cocktail results...</span>
          </div>
        )}
        {submitError && (
          <div style={{ marginTop: 24 }}>
            <p style={{ fontSize: 13, color: "#dc2626", margin: "0 0 16px" }}>{submitError}</p>
            <button
              onClick={onDismissSubmitError}
              style={{
                padding: "10px 20px",
                borderRadius: 10,
                border: "1px solid #e8e8e8",
                background: "rgba(0,0,0,0.04)",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Retry Connection
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function Level2GameView({
  github,
  canAutoSolve,
  isSubmitting,
  timeUp,
  submitError,
  solvedLocal,
  problems,
  answers,
  localCorrect,
  sessionProjects,
  onAutoSolve,
  onFinishGame,
  onAnswerChange,
  onCheckAnswer,
  onDismissSubmitError,
}: Level2GameViewProps) {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#f9f9f9",
        fontFamily: "var(--font-geist-mono), monospace",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.4,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "8px 8px",
        }}
      />

      <div
        style={{
          height: 44,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 14px",
          borderBottom: "1px solid #e8e8e8",
          background: "rgba(255,255,255,0.85)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg
            width="18"
            height="18"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block", verticalAlign: "middle", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
          <span style={{ fontSize: 13, fontWeight: 450, color: "#262626", letterSpacing: 0.3 }}>
            Firecrawl CTF
          </span>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.12)" }}>·</span>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.3)" }}>@{github}</span>
          {canAutoSolve && (
            <button
              onClick={onAutoSolve}
              style={{
                marginLeft: 4,
                padding: "2px 10px",
                fontSize: 11,
                fontWeight: 450,
                background: "rgba(0,0,0,0.04)",
                color: "rgba(0,0,0,0.45)",
                border: "1px solid #e8e8e8",
                borderRadius: 8,
                cursor: "pointer",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Auto Solve
            </button>
          )}
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              background: "rgba(250, 93, 25, 0.15)",
              color: "#fa5d19",
              borderRadius: 4,
              fontWeight: 500,
              marginLeft: 8,
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            LEVEL 2
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <button
            onClick={onFinishGame}
            disabled={isSubmitting}
            className="btn-heat"
            style={{
              height: 32,
              padding: "0 18px",
              borderRadius: 10,
              fontSize: 13,
              fontWeight: 450,
            }}
          >
            {isSubmitting ? "Submitting..." : "Finish & Submit"}
          </button>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          background: "#ffffff",
          borderBottom: "1px solid #e8e8e8",
          padding: "10px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          position: "relative",
          zIndex: 15,
        }}
      >
        <div style={{ display: "flex", gap: 8 }}>
          {sessionProjects.map((projectKey) => {
            const meta = LEVEL2_PROJECT_META[projectKey];
            return (
              <div
                key={projectKey}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "4px 12px",
                  background: "rgba(0,0,0,0.02)",
                  border: "1px solid #e8e8e8",
                  borderRadius: 10,
                }}
              >
                <span
                  style={{ width: 6, height: 6, borderRadius: "50%", background: meta.color }}
                />
                <span style={{ fontSize: 12, fontWeight: 500, color: "#262626" }}>
                  {meta.label}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    color: "rgba(0,0,0,0.3)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  {meta.commit}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 16px 60px",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ maxWidth: 840, margin: "0 auto" }}>
          {problems.map((problem, index) => (
            <ProblemCard
              key={problem.id}
              index={index}
              problem={problem}
              answer={answers[problem.id] || ""}
              status={localCorrect[problem.id]}
              timeUp={timeUp}
              onAnswerChange={(value) => onAnswerChange(problem.id, value)}
              onCheck={() => onCheckAnswer(problem.id)}
            />
          ))}
        </div>
      </div>

      {(timeUp || isSubmitting) && (
        <Level2StatusOverlay
          isSubmitting={isSubmitting}
          submitError={submitError}
          solvedLocal={solvedLocal}
          onDismissSubmitError={onDismissSubmitError}
          onFinishGame={onFinishGame}
        />
      )}
    </div>
  );
}
