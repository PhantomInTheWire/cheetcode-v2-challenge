"use client";

import { CommandBlock } from "@/components/game/CommandBlock";
import { PrereqScreenShell } from "@/components/game/PrereqScreenShell";

const CHROMIUM_CLONE_COMMAND = `git clone https://github.com/chromium/chromium.git
cd chromium
git checkout 69c7c0a024efdc5bec0a9075e306e180b51e4278`;
const FIRECRAWL_COMMAND = "npx -y firecrawl-cli@latest init --all --browser";

export function Level2PrereqScreen({
  pendingLevel,
  onCopy,
  onStart,
  onBack,
}: {
  pendingLevel: number | null;
  onCopy: (text: string) => void | Promise<void>;
  onStart: (level: number) => void | Promise<void>;
  onBack: () => void;
}) {
  return (
    <PrereqScreenShell
      width="min(880px, 100%)"
      title="Before Level 2: Setup Chromium Access"
      actions={
        <>
          <button
            className="btn-heat"
            onClick={() => void onStart(pendingLevel ?? 2)}
            style={{
              height: 36,
              padding: "0 18px",
              borderRadius: 10,
              fontWeight: 450,
              fontSize: 13,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            I&apos;m Ready, Start Level 2
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
        Level 2 expects your agent to reason over Chromium source code. Choose one setup path
        (Option A or Option B):
      </p>
      <ol
        style={{
          margin: "14px 0 0",
          paddingLeft: 20,
          fontSize: 14,
          color: "#262626",
          lineHeight: 1.7,
          fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        }}
      >
        <li>
          <strong style={{ fontWeight: 500 }}>Option A:</strong> Clone Chromium locally so your
          agent can search the codebase directly.
        </li>
        <li>
          <strong style={{ fontWeight: 500 }}>Option B:</strong> Use Firecrawl cli and skill with
          your favourite ai agent and source.chromium.org for web-based exploration.
        </li>
      </ol>
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
          If you choose Option A, run:
        </p>
        <CommandBlock command={CHROMIUM_CLONE_COMMAND} onCopy={onCopy} />
        <p
          style={{
            margin: "12px 0 0",
            fontSize: 13,
            color: "rgba(0,0,0,0.55)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          If you choose Option B, run:
        </p>
        <CommandBlock command={FIRECRAWL_COMMAND} onCopy={onCopy} />
        <p
          style={{
            margin: "10px 0 0",
            fontSize: 13,
            color: "rgba(0,0,0,0.55)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Then search Chromium at:{" "}
          <a
            href="https://source.chromium.org"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#fa5d19", textDecoration: "none", fontWeight: 450 }}
          >
            source.chromium.org
          </a>
        </p>
      </div>
    </PrereqScreenShell>
  );
}
