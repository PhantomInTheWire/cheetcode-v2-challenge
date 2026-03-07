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

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

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
  const short = identity.identityKey.slice(0, 19);
  return `${identity.identityKind.toUpperCase()} · ${short}…`;
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
        background:
          "radial-gradient(circle at top left, var(--color-heat-12), transparent 34%), var(--color-background-base)",
        color: "var(--color-accent-black)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.3,
          backgroundImage:
            "linear-gradient(var(--color-black-alpha-4) 1px, transparent 1px), linear-gradient(90deg, var(--color-black-alpha-4) 1px, transparent 1px)",
          backgroundSize: "10px 10px",
        }}
      />

      <div
        style={{ position: "relative", zIndex: 1, padding: "24px", display: "grid", gap: "16px" }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            padding: "20px 24px",
            border: "1px solid var(--color-border-muted)",
            borderRadius: "var(--radius-20)",
            background: "rgba(255,255,255,0.9)",
            boxShadow: "0 20px 60px var(--color-black-alpha-6)",
            backdropFilter: "blur(16px)",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "11px",
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--color-black-alpha-50)",
                fontFamily: "var(--font-geist-mono), monospace",
                fontWeight: 500,
              }}
            >
              Admin Identity Graph
            </div>
            <h1
              style={{
                margin: "10px 0 0",
                fontSize: "36px",
                lineHeight: 1.05,
                fontWeight: 600,
                letterSpacing: "-0.02em",
              }}
            >
              Linked accounts, shared identities, shadow bans
            </h1>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <a
              href="/admin/replays"
              className="btn-ghost"
              style={{
                textDecoration: "none",
                padding: "12px 18px",
                borderRadius: "var(--radius-full)",
                fontSize: "13px",
                fontFamily: "var(--font-geist-mono), monospace",
                fontWeight: 500,
              }}
            >
              Replay Console
            </a>
            <div
              style={{
                padding: "12px 18px",
                borderRadius: "var(--radius-full)",
                border: "1px solid rgba(250,93,25,0.2)",
                background: "var(--color-heat-8)",
                color: "var(--color-heat-100)",
                fontSize: "13px",
                fontFamily: "var(--font-geist-mono), monospace",
                fontWeight: 500,
              }}
            >
              @{adminGithub}
            </div>
          </div>
        </div>

        {payload ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "14px",
            }}
          >
            {[
              ["Clusters", String(payload.clusters.length)],
              ["Captured Links", String(payload.capturedIdentityLinks)],
              [
                "Flagged Clusters",
                String(payload.clusters.filter((cluster) => cluster.shadowBanned).length),
              ],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  padding: "16px 18px",
                  borderRadius: "var(--radius-16)",
                  border: "1px solid var(--color-border-muted)",
                  background: "rgba(255,255,255,0.88)",
                  boxShadow: "0 2px 8px var(--color-black-alpha-4)",
                }}
              >
                <div
                  style={{
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--color-black-alpha-50)",
                    fontFamily: "var(--font-geist-mono), monospace",
                    fontWeight: 500,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    marginTop: "10px",
                    fontSize: "28px",
                    fontWeight: 600,
                    letterSpacing: "-0.02em",
                  }}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        {payload?.graphWindowLimited ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-16)",
              border: "1px solid rgba(180,83,9,0.2)",
              background: "rgba(180,83,9,0.08)",
              color: "#92400e",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            Identity graph is based on the most recent captured links only. Add backfill if you want
            historical completeness.
          </div>
        ) : null}

        {error ? (
          <div
            style={{
              padding: "14px 16px",
              borderRadius: "var(--radius-16)",
              border: "1px solid rgba(220,38,38,0.2)",
              background: "rgba(220,38,38,0.08)",
              color: "#b91c1c",
              fontSize: "14px",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        ) : null}

        <div style={{ display: "grid", gap: "18px" }}>
          {(payload?.clusters ?? []).map((cluster) => {
            const bannedCount = cluster.identities.filter(
              (identity) => identity.shadowBanned,
            ).length;
            const allBanned = bannedCount > 0 && bannedCount === cluster.identities.length;

            return (
              <section
                key={cluster.id}
                style={{
                  border: "1px solid var(--color-border-muted)",
                  borderRadius: "var(--radius-20)",
                  background: "rgba(255,255,255,0.94)",
                  boxShadow: "0 18px 48px var(--color-black-alpha-5)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    padding: "18px 22px",
                    borderBottom: "1px solid var(--color-border-faint)",
                    display: "flex",
                    justifyContent: "space-between",
                    gap: "20px",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--color-black-alpha-50)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontWeight: 500,
                      }}
                    >
                      Identity Cluster
                    </div>
                    <div
                      style={{
                        marginTop: "10px",
                        fontSize: "26px",
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {cluster.accounts.map((account) => `@${account.github}`).join("  ")}
                    </div>
                    <div
                      style={{
                        marginTop: "10px",
                        fontSize: "13px",
                        color: "var(--color-black-alpha-50)",
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      {cluster.accountCount} account{cluster.accountCount === 1 ? "" : "s"} linked •
                      last seen {formatRelative(cluster.lastSeenAt)} (
                      {formatTime(cluster.lastSeenAt)})
                    </div>
                  </div>

                  <button
                    type="button"
                    className={allBanned ? "btn-ghost" : "btn-heat"}
                    onClick={() => void toggleClusterBan(cluster)}
                    disabled={pendingClusterId === cluster.id || cluster.identities.length === 0}
                    style={{
                      padding: "12px 20px",
                      borderRadius: "var(--radius-full)",
                      fontSize: "13px",
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontWeight: 500,
                    }}
                  >
                    {pendingClusterId === cluster.id
                      ? "Updating…"
                      : allBanned
                        ? "Lift Cluster Ban"
                        : "Shadow Ban Cluster"}
                  </button>
                </div>

                <div
                  style={{
                    padding: "20px",
                    display: "grid",
                    gridTemplateColumns: "minmax(280px, 0.9fr) minmax(0, 1.2fr)",
                    gap: "18px",
                    alignItems: "start",
                  }}
                >
                  <div
                    style={{
                      border: "1px solid var(--color-border-muted)",
                      borderRadius: "var(--radius-16)",
                      background: "var(--color-surface-raised)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--color-border-faint)",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--color-black-alpha-50)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontWeight: 500,
                      }}
                    >
                      Accounts
                    </div>
                    <div style={{ display: "grid" }}>
                      {cluster.accounts.map((account) => (
                        <div
                          key={account.github}
                          style={{
                            padding: "14px 16px",
                            borderBottom: "1px solid var(--color-border-faint)",
                            display: "grid",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "14px",
                            }}
                          >
                            <strong style={{ fontSize: "15px" }}>@{account.github}</strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-geist-mono), monospace",
                                color: account.shadowBanned
                                  ? "#b91c1c"
                                  : "var(--color-accent-forest)",
                                fontWeight: 500,
                              }}
                            >
                              {account.shadowBanned ? "SHADOW BANNED" : "clear"}
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--color-black-alpha-50)" }}>
                            Levels {account.levels.join(", ")} • {account.sessionIds.length} session
                            {account.sessionIds.length === 1 ? "" : "s"}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--color-black-alpha-50)",
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            Last seen {formatRelative(account.lastSeenAt)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div
                    style={{
                      border: "1px solid var(--color-border-muted)",
                      borderRadius: "var(--radius-16)",
                      background: "var(--color-surface)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        padding: "14px 16px",
                        borderBottom: "1px solid var(--color-border-faint)",
                        fontSize: "11px",
                        textTransform: "uppercase",
                        letterSpacing: "0.12em",
                        color: "var(--color-black-alpha-50)",
                        fontFamily: "var(--font-geist-mono), monospace",
                        fontWeight: 500,
                      }}
                    >
                      Linking Evidence
                    </div>
                    <div style={{ display: "grid" }}>
                      {cluster.identities.map((identity) => (
                        <div
                          key={identity.identityKey}
                          style={{
                            padding: "14px 16px",
                            borderBottom: "1px solid var(--color-border-faint)",
                            display: "grid",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              gap: "14px",
                            }}
                          >
                            <strong
                              style={{
                                fontFamily: "var(--font-geist-mono), monospace",
                                fontSize: "13px",
                                color:
                                  identity.identityKind === "fp"
                                    ? "var(--color-heat-100)"
                                    : "#0f766e",
                              }}
                            >
                              {labelIdentity(identity)}
                            </strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-geist-mono), monospace",
                                color: identity.shadowBanned
                                  ? "#b91c1c"
                                  : "var(--color-black-alpha-50)",
                                fontWeight: 500,
                              }}
                            >
                              {identity.shadowBanned ? "banned" : "clear"}
                            </span>
                          </div>
                          <div style={{ fontSize: "13px", color: "var(--color-black-alpha-50)" }}>
                            Shared by {identity.accountCount} account
                            {identity.accountCount === 1 ? "" : "s"} • {identity.sessionCount}{" "}
                            session
                            {identity.sessionCount === 1 ? "" : "s"}
                          </div>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--color-black-alpha-50)",
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {identity.accounts.map((account) => `@${account}`).join(" · ")}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
