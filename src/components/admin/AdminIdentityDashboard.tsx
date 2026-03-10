"use client";

import { startTransition, useCallback, useEffect, useState } from "react";

const REFRESH_MS = 4_000;

type IdentityNode = {
  identityKey: string;
  identityKind: "ip" | "fp";
  shadowBanned: boolean;
  accountCount: number;
  sessionCount: number;
  lastSeenAt: number;
  accounts: string[];
};

type AccountNode = {
  github: string;
  shadowBanned: boolean;
  lastSeenAt: number;
  levels: number[];
  sessionIds: string[];
  identityKeys: string[];
};

type Cluster = {
  id: string;
  accountCount: number;
  lastSeenAt: number;
  shadowBanned: boolean;
  accounts: AccountNode[];
  identities: IdentityNode[];
};

type GraphPayload = {
  capturedIdentityLinks: number;
  graphWindowLimited: boolean;
  clusters: Cluster[];
};

function formatRelative(timestamp: number) {
  const deltaMs = Date.now() - timestamp;
  if (deltaMs < 1_000) return "now";
  const seconds = Math.round(deltaMs / 1_000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function labelIdentity(identity: IdentityNode) {
  if (identity.identityKind === "ip") {
    const short = identity.identityKey.slice(0, 19);
    return `${identity.identityKind.toUpperCase()} · ${short}…`;
  }

  const [, subtype = "fp", rawValue = ""] = identity.identityKey.split(":", 3);
  const short = rawValue.slice(0, 24);
  const label =
    subtype === "id"
      ? "Fingerprint ID"
      : subtype === "profile"
        ? "Profile Hash"
        : subtype === "environment"
          ? "Environment Hash"
          : subtype === "display"
            ? "Display Hash"
            : subtype === "rendering"
              ? "Render Hash"
              : subtype === "device"
                ? "Device Cluster"
                : subtype === "locale"
                  ? "Locale Cluster"
                  : "Fingerprint";
  return `${label} · ${short}${rawValue.length > short.length ? "…" : ""}`;
}

export function AdminIdentityDashboard({ adminGithub }: { adminGithub: string }) {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingClusterId, setPendingClusterId] = useState<string | null>(null);

  const loadGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/identity?limit=1800", { cache: "no-store" });
      const data = (await res.json()) as GraphPayload & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load identity graph");
      startTransition(() => setPayload(data));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load identity graph");
    }
  }, []);

  const toggleClusterBan = useCallback(
    async (cluster: Cluster) => {
      const active = cluster.identities.filter((identity) => identity.shadowBanned).length;
      const action = active === cluster.identities.length ? "unshadow_ban" : "shadow_ban";
      setPendingClusterId(cluster.id);
      try {
        const res = await fetch("/api/admin/identity", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            action,
            identityKeys: cluster.identities.map((identity) => identity.identityKey),
          }),
        });
        const data = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(data.error || "Failed to update shadow ban state");
        await loadGraph();
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Failed to update shadow ban state",
        );
      } finally {
        setPendingClusterId(null);
      }
    },
    [loadGraph],
  );

  useEffect(() => {
    void loadGraph();
    const intervalId = window.setInterval(() => {
      void loadGraph();
    }, REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [loadGraph]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9f9f9",
        color: "#262626",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)",
          backgroundSize: "8px 8px",
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 1,
          padding: "32px 24px",
          maxWidth: 1400,
          margin: "0 auto",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 32,
          }}
        >
          <div>
            <h1
              style={{
                fontSize: 32,
                fontWeight: 500,
                letterSpacing: -0.32,
                margin: 0,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              Identity <span style={{ color: "#fa5d19" }}>Graph</span>
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "rgba(0,0,0,0.5)",
                margin: "4px 0 0",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              Linked accounts, shared identities, shadow bans
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <a
              href="/admin"
              style={{
                fontSize: 13,
                color: "rgba(0,0,0,0.4)",
                textDecoration: "none",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              ← Back
            </a>
            <a
              href="/admin/replays"
              style={{
                padding: "6px 12px",
                background: "rgba(0,0,0,0.04)",
                borderRadius: 8,
                fontSize: 13,
                color: "#262626",
                textDecoration: "none",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Replays
            </a>
            <div
              style={{
                padding: "6px 12px",
                background: "rgba(250,93,25,0.08)",
                borderRadius: 8,
                fontSize: 13,
                color: "#fa5d19",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              @{adminGithub}
            </div>
          </div>
        </div>

        {payload && (
          <div
            style={{
              display: "flex",
              gap: 16,
              marginBottom: 24,
              fontSize: 13,
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            <div>
              <span style={{ color: "rgba(0,0,0,0.4)" }}>Clusters:</span>{" "}
              <span style={{ color: "#fa5d19" }}>{payload.clusters.length}</span>
            </div>
            <div>
              <span style={{ color: "rgba(0,0,0,0.4)" }}>Links:</span>{" "}
              <span style={{ color: "#fa5d19" }}>{payload.capturedIdentityLinks}</span>
            </div>
            <div>
              <span style={{ color: "rgba(0,0,0,0.4)" }}>Flagged:</span>{" "}
              <span style={{ color: "#fa5d19" }}>
                {payload.clusters.filter((c) => c.shadowBanned).length}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div
            style={{
              padding: "12px 16px",
              background: "rgba(235,52,36,0.05)",
              border: "1px solid rgba(235,52,36,0.12)",
              borderRadius: 10,
              color: "#eb3424",
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: "grid", gap: 16 }}>
          {(payload?.clusters ?? []).map((cluster) => {
            const bannedCount = cluster.identities.filter((i) => i.shadowBanned).length;
            const allBanned = bannedCount > 0 && bannedCount === cluster.identities.length;

            return (
              <div
                key={cluster.id}
                style={{
                  background: "rgba(255,255,255,0.6)",
                  border: "1px solid rgba(0,0,0,0.06)",
                  borderRadius: 12,
                  padding: 20,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "start",
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>
                      {cluster.accounts.map((a) => `@${a.github}`).join(", ")}
                    </div>
                    <div
                      style={{
                        fontSize: 13,
                        color: "rgba(0,0,0,0.5)",
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {cluster.accountCount} account{cluster.accountCount === 1 ? "" : "s"} · last
                      seen {formatRelative(cluster.lastSeenAt)}
                    </div>
                  </div>
                  <button
                    onClick={() => void toggleClusterBan(cluster)}
                    disabled={pendingClusterId === cluster.id}
                    style={{
                      padding: "8px 16px",
                      background: allBanned ? "rgba(0,0,0,0.04)" : "#ff4c00",
                      color: allBanned ? "#262626" : "#fff",
                      border: "none",
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 450,
                      cursor: "pointer",
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    }}
                  >
                    {pendingClusterId === cluster.id ? "..." : allBanned ? "Unban" : "Ban"}
                  </button>
                </div>

                <div
                  style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, fontSize: 13 }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,0.4)",
                        marginBottom: 8,
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      Accounts
                    </div>
                    {cluster.accounts.map((acc) => (
                      <div
                        key={acc.github}
                        style={{ padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.04)" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span>@{acc.github}</span>
                          <span
                            style={{
                              fontSize: 11,
                              color: acc.shadowBanned ? "#eb3424" : "#1a9338",
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {acc.shadowBanned ? "BANNED" : "clear"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>
                          L{acc.levels.join(", L")} · {acc.sessionIds.length} session
                          {acc.sessionIds.length === 1 ? "" : "s"}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <div
                      style={{
                        fontSize: 11,
                        textTransform: "uppercase",
                        color: "rgba(0,0,0,0.4)",
                        marginBottom: 8,
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      Evidence
                    </div>
                    {cluster.identities.map((id) => (
                      <div
                        key={id.identityKey}
                        style={{ padding: "8px 0", borderTop: "1px solid rgba(0,0,0,0.04)" }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <span
                            style={{
                              fontSize: 12,
                              fontFamily: "var(--font-geist-mono), monospace",
                              color: id.identityKind === "fp" ? "#fa5d19" : "#0f766e",
                            }}
                          >
                            {labelIdentity(id)}
                          </span>
                          <span
                            style={{
                              fontSize: 11,
                              color: id.shadowBanned ? "#eb3424" : "rgba(0,0,0,0.3)",
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {id.shadowBanned ? "banned" : "clear"}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.4)", marginTop: 2 }}>
                          {id.accountCount} account{id.accountCount === 1 ? "" : "s"} ·{" "}
                          {id.sessionCount} session{id.sessionCount === 1 ? "" : "s"}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
