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
            style={{ height: 36, padding: "0 16px", borderRadius: 8, fontWeight: 700 }}
          >
            I&apos;m Ready, Start Level 2
          </button>
          <button
            className="btn-ghost"
            onClick={onBack}
            style={{ height: 36, padding: "0 16px", borderRadius: 8, fontWeight: 700 }}
          >
            Back
          </button>
        </>
      }
    >
      <p style={{ margin: "10px 0 0", fontSize: 13, color: "rgba(0,0,0,0.7)" }}>
        Level 2 expects your agent to reason over Chromium source code. Choose one setup path
        (Option A or Option B):
      </p>
      <ol style={{ margin: "14px 0 0", paddingLeft: 20, fontSize: 13, color: "#262626" }}>
        <li>
          <strong>Option A:</strong> Clone Chromium locally so your agent can search the codebase
          directly.
        </li>
        <li>
          <strong>Option B:</strong> Use Firecrawl cli and skill with your favourite ai agent and
          source.chromium.org for web-based exploration.
        </li>
      </ol>
      <div
        style={{
          marginTop: 14,
          background: "#fff7f2",
          border: "1px solid #ffd5c0",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
          If you choose Option A, run:
        </p>
        <CommandBlock command={CHROMIUM_CLONE_COMMAND} onCopy={onCopy} />
        <p style={{ margin: 0, fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
          If you choose Option B, run:
        </p>
        <CommandBlock command={FIRECRAWL_COMMAND} onCopy={onCopy} />
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(0,0,0,0.7)" }}>
          Then search Chromium at: https://source.chromium.org
        </p>
      </div>
    </PrereqScreenShell>
  );
}
