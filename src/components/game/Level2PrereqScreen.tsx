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
      width="min(880px, 100%)"
      title="Level 2: Multi-Project Access"
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
              height: 36,
              padding: "0 24px",
              borderRadius: 10,
              fontWeight: 450,
              fontSize: 13,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {level2PreviewLoading ? "Loading..." : "I'm Ready, Start Level 2"}
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
        [ Setup Instructions ]
      </div>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: 14,
          color: "rgba(0,0,0,0.6)",
          lineHeight: 1.6,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        {level2PreviewLoading ? (
          "Loading your exact Level 2 repository pair..."
        ) : previewProjects.length === 2 ? (
          <>
            Your Level 2 round is pinned to exactly two repositories and commit refs below. Prepare
            only for these two targets.
          </>
        ) : (
          "Unable to load Level 2 repo pair right now. Retry or go back and reopen Level 2."
        )}
      </p>
      {level2Preview && level2Preview.length === 2 && (
        <div
          style={{
            background: "#fff",
            border: "1px solid #e8e8e8",
            borderRadius: 12,
            padding: 14,
            marginBottom: 16,
          }}
        >
          {level2Preview.map((repo) => (
            <p
              key={repo.key}
              style={{
                margin: "0 0 8px",
                fontSize: 12,
                color: "rgba(0,0,0,0.55)",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {repo.label}: {repo.commit}
            </p>
          ))}
        </div>
      )}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 20,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            background: "rgba(0,0,0,0.02)",
            border: "1px solid #e8e8e8",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 13,
              fontWeight: 500,
              color: "#262626",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Option A: Local Clone
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(0,0,0,0.5)",
              lineHeight: 1.5,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Clone only the two repositories listed above and checkout the shown commit refs.
          </p>
        </div>
        <div
          style={{
            background: "rgba(250,93,25,0.03)",
            border: "1px solid rgba(250,93,25,0.15)",
            borderRadius: 12,
            padding: 16,
          }}
        >
          <h3
            style={{
              margin: "0 0 8px",
              fontSize: 13,
              fontWeight: 500,
              color: "#fa5d19",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Option B: Firecrawl
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: 13,
              color: "rgba(0,0,0,0.5)",
              lineHeight: 1.5,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            Use Firecrawl CLI and browser tools with your favorite AI agent for instant web-based
            exploration.
          </p>
        </div>
      </div>

      <div
        style={{
          background: "#fafafa",
          border: "1px solid #e8e8e8",
          borderRadius: 12,
          padding: 14,
        }}
      >
        <div style={{ marginBottom: 16 }}>
          <span
            style={{
              fontSize: 11,
              color: "rgba(0,0,0,0.35)",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              display: "block",
              marginBottom: 6,
            }}
          >
            [ Option B Commands ]
          </span>
          <CommandBlock command={FIRECRAWL_COMMAND} onCopy={onCopy} />
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(0,0,0,0.55)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          After you start Level 2, use only the two repos listed for your session in the game
          header, each with its pinned commit hash.
        </p>
      </div>
      {level2PreviewError && (
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
          {level2PreviewError}
        </div>
      )}
    </PrereqScreenShell>
  );
}
