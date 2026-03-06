"use client";

import { CommandBlock } from "@/components/game/CommandBlock";
import { PrereqScreenShell } from "@/components/game/PrereqScreenShell";

export function Level3PrereqScreen({
  pendingLevel,
  level3Preview,
  level3PreviewLoading,
  level3PreviewError,
  compilerCommand,
  onCopy,
  onStart,
  onBack,
}: {
  pendingLevel: number | null;
  level3Preview: {
    challengeId: string;
    taskName: string;
    language: string;
  } | null;
  level3PreviewLoading: boolean;
  level3PreviewError: string | null;
  compilerCommand: string;
  onCopy: (text: string) => void | Promise<void>;
  onStart: (level: number, challengeId?: string) => void | Promise<void>;
  onBack: () => void;
}) {
  return (
    <PrereqScreenShell
      width="min(760px, 100%)"
      title="Level 3: Compiler Readiness"
      actions={
        <>
          <button
            className="btn-heat"
            onClick={() => void onStart(pendingLevel ?? 3, level3Preview?.challengeId)}
            disabled={level3PreviewLoading}
            style={{
              height: 36,
              padding: "0 24px",
              borderRadius: 10,
              fontWeight: 450,
              fontSize: 13,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {level3PreviewLoading ? "Loading..." : "Compiler Ready, Start Level 3"}
          </button>
          <button
            className="btn-ghost"
            onClick={onBack}
            style={{
              height: 36,
              padding: "0 20px",
              borderRadius: 10,
              fontWeight: 450,
              fontSize: 13,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Back
          </button>
        </>
      }
    >
      <div
        style={{
          fontSize: 12,
          color: "rgba(0,0,0,0.12)",
          fontFamily: "var(--font-geist-mono), monospace",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: 16,
          marginTop: 12,
        }}
      >
        [ Preparation ]
      </div>
      <p
        style={{
          margin: "0 0 20px",
          fontSize: 14,
          color: "rgba(0,0,0,0.6)",
          lineHeight: 1.6,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        {level3PreviewLoading ? (
          "Loading your next Level 3 challenge details..."
        ) : level3Preview ? (
          <>
            Your next Level 3 challenge is{" "}
            <strong style={{ fontWeight: 500, color: "#262626" }}>{level3Preview.taskName}</strong>{" "}
            assigned in{" "}
            <strong style={{ fontWeight: 500, color: "#fa5d19" }}>{level3Preview.language}</strong>.
            Confirm your local environment is configured for systems development.
          </>
        ) : (
          <>
            Confirm you have a <strong style={{ fontWeight: 500, color: "#262626" }}>C</strong>,{" "}
            <strong style={{ fontWeight: 500, color: "#262626" }}>C++</strong>, or{" "}
            <strong style={{ fontWeight: 500, color: "#262626" }}>Rust</strong> compiler ready for
            the Level 3 systems challenge.
          </>
        )}
      </p>

      <div
        style={{
          background: "#fafafa",
          border: "1px solid #e8e8e8",
          borderRadius: 12,
          padding: 16,
        }}
      >
        <span
          style={{
            fontSize: 11,
            color: "rgba(0,0,0,0.35)",
            fontFamily: "var(--font-geist-mono), monospace",
            textTransform: "uppercase",
            display: "block",
            marginBottom: 8,
          }}
        >
          [ Recommended Diagnostic ]
        </span>
        <CommandBlock command={compilerCommand} onCopy={onCopy} />
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 12,
            color: "rgba(0,0,0,0.4)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            fontStyle: "italic",
          }}
        >
          Tip: Ensure you can compile and run a basic &quot;Hello World&quot; in{" "}
          {level3Preview?.language || "the target language"} before starting.
        </p>
      </div>

      {level3PreviewError && (
        <div
          style={{
            marginTop: 16,
            padding: "10px 14px",
            background: "rgba(220,38,38,0.05)",
            border: "1px solid rgba(220,38,38,0.15)",
            borderRadius: 8,
            color: "#dc2626",
            fontSize: 13,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {level3PreviewError}
        </div>
      )}
    </PrereqScreenShell>
  );
}
