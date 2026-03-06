"use client";

import { CommandBlock } from "@/components/game/CommandBlock";
import { PrereqScreenShell } from "@/components/game/PrereqScreenShell";

const FIRECRAWL_COMMAND = "npx -y firecrawl-cli@latest init --all --browser";

export function Level2PrereqScreen({
  pendingLevel,
  level2Preview,
  level2PreviewLoading,
  level2PreviewError,
  onCopy,
  onStart,
  onBack,
}: {
  pendingLevel: number | null;
  level2Preview: Array<{ key: string; label: string; commit: string }> | null;
  level2PreviewLoading: boolean;
  level2PreviewError: string | null;
  onCopy: (text: string) => void | Promise<void>;
  onStart: (
    level: number,
    level3ChallengeId?: string,
    level2Projects?: string[],
  ) => void | Promise<void>;
  onBack: () => void;
}) {
  const previewProjects = level2Preview?.map((entry) => entry.key) ?? [];
  const hasValidPreviewPair = previewProjects.length === 2;

  return (
    <PrereqScreenShell
      width="min(940px, 100%)"
      title="Level 2: The Source Cocktail"
      actions={
        <>
          <button
            className="btn-heat"
            onClick={() =>
              void onStart(
                pendingLevel ?? 2,
                undefined,
                hasValidPreviewPair ? previewProjects : undefined,
              )
            }
            disabled={level2PreviewLoading}
            style={{
              height: 40,
              padding: "0 28px",
              borderRadius: 12,
              fontWeight: 500,
              fontSize: 14,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {level2PreviewLoading ? "Preparing Targets..." : "Launch Mission"}
          </button>
          <button
            className="btn-ghost"
            onClick={onBack}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 12,
              fontWeight: 500,
              fontSize: 14,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Abort
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
        [ MISSION_BRIEF ]
      </div>
      <p
        style={{
          margin: "0 0 24px",
          fontSize: 15,
          color: "rgba(0,0,0,0.65)",
          lineHeight: 1.6,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        Your Level 2 challenge is a random{" "}
        <strong style={{ color: "#fa5d19", fontWeight: 500 }}>2-project cocktail</strong>. Assign
        your agent to exactly two targets from the global source pool. Preparations should be
        confined strictly to these pinned refs:
      </p>

      {/* ── The Cocktail Display ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 16,
          marginBottom: 32,
        }}
      >
        {level2PreviewLoading ? (
          [0, 1].map((i) => (
            <div
              key={i}
              style={{
                height: 100,
                background: "rgba(0,0,0,0.02)",
                border: "1px dashed #e8e8e8",
                borderRadius: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(0,0,0,0.2)",
                fontSize: 12,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              [ FETCHING_TARGET_0{i + 1} ]
            </div>
          ))
        ) : level2Preview && level2Preview.length === 2 ? (
          level2Preview.map((repo, i) => (
            <div
              key={repo.key}
              style={{
                background: i === 0 ? "#ffffff" : "rgba(250,93,25,0.02)",
                border: i === 0 ? "1px solid #e8e8e8" : "1px solid rgba(250,93,25,0.15)",
                borderRadius: 16,
                padding: "20px 24px",
                boxShadow: "0 2px 6px rgba(0,0,0,0.02)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: i === 0 ? "rgba(0,0,0,0.25)" : "rgba(250,93,25,0.4)",
                  fontFamily: "var(--font-geist-mono), monospace",
                  marginBottom: 8,
                }}
              >
                TARGET_0{i + 1}
              </div>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 600,
                  color: i === 0 ? "#262626" : "#fa5d19",
                  fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  letterSpacing: "-0.02em",
                  marginBottom: 4,
                }}
              >
                {repo.label}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: i === 0 ? "rgba(0,0,0,0.45)" : "rgba(250,93,25,0.6)",
                  fontFamily: "var(--font-geist-mono), monospace",
                }}
              >
                ref: {repo.commit}
              </div>
            </div>
          ))
        ) : (
          <div
            style={{
              gridColumn: "span 2",
              padding: 24,
              background: "#fff1f1",
              border: "1px solid #ffcccc",
              borderRadius: 16,
              textAlign: "center",
              color: "#cc0000",
              fontSize: 14,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {level2PreviewError || "Sync error: Target pool unavailable."}
          </div>
        )}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 24,
          marginBottom: 24,
        }}
      >
        <div>
          <span
            style={{
              fontSize: 11,
              color: "rgba(0,0,0,0.35)",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              display: "block",
              marginBottom: 12,
            }}
          >
            [ OPTION_A: LOCAL_INTEGRATION ]
          </span>
          <p
            style={{
              margin: "0 0 16px",
              fontSize: 13,
              color: "rgba(0,0,0,0.5)",
              lineHeight: 1.5,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Clone the repositories listed above and checkout the specified commit refs.
          </p>
        </div>

        <div>
          <span
            style={{
              fontSize: 11,
              color: "rgba(250,93,25,0.4)",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              display: "block",
              marginBottom: 12,
            }}
          >
            [ OPTION_B: FIRECRAWL_API ]
          </span>
          <CommandBlock command={FIRECRAWL_COMMAND} onCopy={onCopy} />
        </div>
      </div>

      <div
        style={{
          borderTop: "1px solid #f0f0f0",
          paddingTop: 20,
          marginTop: 8,
          fontSize: 12,
          color: "rgba(0,0,0,0.35)",
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          fontStyle: "italic",
          textAlign: "center",
        }}
      >
        Note: You will be served 5 questions per target codebase (10 total).
      </div>
    </PrereqScreenShell>
  );
}
