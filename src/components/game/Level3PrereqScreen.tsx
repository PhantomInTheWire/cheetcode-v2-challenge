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
      title="Before Level 3: Compiler Readiness"
      actions={
        <>
          <button
            className="btn-heat"
            onClick={() => void onStart(pendingLevel ?? 3, level3Preview?.challengeId)}
            disabled={level3PreviewLoading}
            style={{
              height: 36,
              padding: "0 18px",
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
              padding: "0 18px",
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
      <p
        style={{
          margin: "12px 0 0",
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
            <strong style={{ fontWeight: 500 }}>{level3Preview.taskName}</strong> in{" "}
            <strong style={{ fontWeight: 500 }}>{level3Preview.language}</strong>. Confirm your
            compiler is ready.
          </>
        ) : (
          <>
            Confirm you have a <strong style={{ fontWeight: 500 }}>C</strong>,{" "}
            <strong style={{ fontWeight: 500 }}>C++</strong>, or{" "}
            <strong style={{ fontWeight: 500 }}>Rust</strong> compiler ready for the Level 3 systems
            challenge.
          </>
        )}
      </p>
      <div
        style={{
          marginTop: 16,
          background: "#fafafa",
          border: "1px solid #e8e8e8",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(0,0,0,0.55)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Suggested local check:
        </p>
        <CommandBlock command={compilerCommand} onCopy={onCopy} />
      </div>
      {level3PreviewError && (
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 13,
            color: "#dc2626",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {level3PreviewError}
        </p>
      )}
    </PrereqScreenShell>
  );
}
