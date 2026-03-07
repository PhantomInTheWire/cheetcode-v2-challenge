"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useState,
} from "react";

const LIST_REFRESH_MS = 2_500;
const DETAIL_REFRESH_MS = 1_500;

type ReplaySessionRow = {
  sessionId: string;
  github: string;
  level: number;
  screen: string;
  status: string;
  lastSeenAt: number;
  lastEventAt: number;
  lastEventType: string;
  eventCount: number;
  duplicateSnapshotCount: number;
  expiresAt: number;
  summary?: Record<string, unknown> | null;
  live: boolean;
};

type ReplayEventRow = {
  _id: string;
  createdAt: number;
  eventType: string;
  screen: string;
  route: string;
  sequence: number;
  duplicateOfPrevious: boolean;
  summary?: Record<string, unknown> | null;
  snapshot?: Record<string, unknown> | null;
};

type AttemptEventRow = {
  _id: string;
  createdAt: number;
  eventType: string;
  status: string;
  passCount?: number;
  failCount?: number;
  summary?: Record<string, unknown> | null;
};

type ReplayDetail = {
  session?: {
    _id: string;
    github: string;
    startedAt: number;
    expiresAt: number;
    level?: number;
    problemIds: string[];
  } | null;
  presence?: {
    screen: string;
    status: string;
    lastSeenAt: number;
    eventCount: number;
    duplicateSnapshotCount: number;
    summary?: Record<string, unknown> | null;
    snapshotPreview?: Record<string, unknown> | null;
  } | null;
  replayEvents: ReplayEventRow[];
  attemptEvents: AttemptEventRow[];
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

function codeBlocksFromSnapshot(snapshot: Record<string, unknown> | null | undefined) {
  if (!snapshot) return [];
  if (snapshot.type === "level1" && snapshot.codes && typeof snapshot.codes === "object") {
    return Object.entries(snapshot.codes as Record<string, string>).map(([key, value]) => ({
      label: key,
      value,
    }));
  }
  if (snapshot.type === "level2" && snapshot.answers && typeof snapshot.answers === "object") {
    return Object.entries(snapshot.answers as Record<string, string>).map(([key, value]) => ({
      label: key,
      value,
    }));
  }
  if (snapshot.type === "level3" && typeof snapshot.code === "string") {
    return [{ label: "solution", value: snapshot.code }];
  }
  return [];
}

function renderJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

export function AdminReplayDashboard({ adminGithub }: { adminGithub: string }) {
  const [sessions, setSessions] = useState<ReplaySessionRow[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ReplayDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deferredSessionId = useDeferredValue(selectedSessionId);

  const loadSessions = useEffectEvent(async () => {
    try {
      const res = await fetch("/api/admin/replays?limit=24", { cache: "no-store" });
      const data = (await res.json()) as { error?: string; sessions?: ReplaySessionRow[] };
      if (!res.ok) throw new Error(data.error || "Failed to load sessions");
      startTransition(() => {
        const nextSessions = data.sessions ?? [];
        setSessions(nextSessions);
        setSelectedSessionId((current) =>
          current && nextSessions.some((session) => session.sessionId === current)
            ? current
            : (nextSessions[0]?.sessionId ?? null),
        );
      });
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load sessions");
    }
  });

  const loadDetail = useEffectEvent(async (sessionId: string) => {
    try {
      const res = await fetch(
        `/api/admin/replays?sessionId=${encodeURIComponent(sessionId)}&limit=180`,
        {
          cache: "no-store",
        },
      );
      const data = (await res.json()) as ReplayDetail & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load session detail");
      startTransition(() => {
        setDetail(data);
      });
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Failed to load session detail");
    }
  });

  useEffect(() => {
    void loadSessions();
    const intervalId = window.setInterval(() => {
      void loadSessions();
    }, LIST_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!deferredSessionId) {
      setDetail(null);
      return;
    }
    void loadDetail(deferredSessionId);
    const intervalId = window.setInterval(() => {
      void loadDetail(deferredSessionId);
    }, DETAIL_REFRESH_MS);
    return () => window.clearInterval(intervalId);
  }, [deferredSessionId]);

  const currentSnapshot = useMemo(
    () => detail?.replayEvents.findLast((event) => Boolean(event.snapshot))?.snapshot ?? null,
    [detail],
  );
  const codeBlocks = useMemo(() => codeBlocksFromSnapshot(currentSnapshot), [currentSnapshot]);

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
        style={{
          position: "relative",
          zIndex: 1,
          padding: "24px",
          display: "grid",
          gap: "16px",
        }}
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
              Admin Replay Console
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
              Session replays and live spectating
            </h1>
          </div>
          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <a
              href="/admin/identity"
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
              Identity Graph
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(300px, 360px) minmax(0, 1fr)",
            gap: "18px",
            alignItems: "start",
          }}
        >
          <section
            style={{
              border: "1px solid var(--color-border-muted)",
              borderRadius: "var(--radius-20)",
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 18px 48px var(--color-black-alpha-5)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                borderBottom: "1px solid var(--color-border-faint)",
                fontSize: "11px",
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                color: "var(--color-black-alpha-50)",
                fontFamily: "var(--font-geist-mono), monospace",
                fontWeight: 500,
              }}
            >
              Live Sessions
            </div>
            <div style={{ display: "grid" }}>
              {sessions.map((session) => {
                const selected = session.sessionId === selectedSessionId;
                return (
                  <button
                    key={session.sessionId}
                    type="button"
                    onClick={() => setSelectedSessionId(session.sessionId)}
                    style={{
                      textAlign: "left",
                      border: 0,
                      borderBottom: "1px solid var(--color-border-faint)",
                      background: selected ? "var(--color-heat-8)" : "transparent",
                      padding: "16px 18px",
                      cursor: "pointer",
                      display: "grid",
                      gap: "8px",
                      transition: "background 0.15s ease",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "14px",
                      }}
                    >
                      <strong style={{ fontSize: "16px", fontWeight: 600 }}>
                        @{session.github}
                      </strong>
                      <span
                        style={{
                          padding: "5px 10px",
                          borderRadius: "var(--radius-full)",
                          background: session.live
                            ? "rgba(26,147,56,0.12)"
                            : "var(--color-black-alpha-8)",
                          color: session.live
                            ? "var(--color-accent-forest)"
                            : "var(--color-black-alpha-50)",
                          fontSize: "11px",
                          fontFamily: "var(--font-geist-mono), monospace",
                          fontWeight: 500,
                        }}
                      >
                        {session.live ? "LIVE" : session.status.toUpperCase()}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "14px",
                        fontSize: "13px",
                        color: "var(--color-black-alpha-50)",
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      <span>
                        L{session.level} · {session.screen}
                      </span>
                      <span>{formatRelative(session.lastSeenAt)}</span>
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--color-black-alpha-50)" }}>
                      {session.eventCount} replay events · {session.duplicateSnapshotCount} dupes
                    </div>
                  </button>
                );
              })}
              {sessions.length === 0 ? (
                <div
                  style={{ padding: "20px", color: "var(--color-black-alpha-50)", fontSize: 14 }}
                >
                  No replay data yet.
                </div>
              ) : null}
            </div>
          </section>

          <section
            style={{
              border: "1px solid var(--color-border-muted)",
              borderRadius: "var(--radius-20)",
              background: "rgba(255,255,255,0.92)",
              boxShadow: "0 18px 48px var(--color-black-alpha-5)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--color-border-faint)",
                display: "flex",
                justifyContent: "space-between",
                gap: "18px",
                alignItems: "center",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "13px",
                    textTransform: "uppercase",
                    letterSpacing: "0.12em",
                    color: "var(--color-black-alpha-50)",
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
                  Spectator View
                </div>
                <div style={{ marginTop: 8, fontSize: "26px", fontWeight: 600 }}>
                  {detail?.session ? `@${detail.session.github}` : "Select a session"}
                </div>
              </div>
              {detail?.presence ? (
                <div
                  style={{
                    padding: "10px 14px",
                    borderRadius: "var(--radius-16)",
                    background: "var(--color-heat-8)",
                    border: "1px solid rgba(250,93,25,0.2)",
                    fontSize: "13px",
                    fontFamily: "var(--font-geist-mono), monospace",
                    color: "var(--color-heat-100)",
                  }}
                >
                  {detail.presence.status.toUpperCase()} · {detail.presence.screen}
                </div>
              ) : null}
            </div>

            {detail ? (
              <div style={{ padding: "20px", display: "grid", gap: 16 }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "14px",
                  }}
                >
                  {[
                    [
                      "Last Seen",
                      detail.presence
                        ? `${formatRelative(detail.presence.lastSeenAt)} (${formatTime(detail.presence.lastSeenAt)})`
                        : "n/a",
                    ],
                    ["Started", detail.session ? formatTime(detail.session.startedAt) : "n/a"],
                    [
                      "Replay Events",
                      String(detail.presence?.eventCount ?? detail.replayEvents.length),
                    ],
                    ["Attempt Events", String(detail.attemptEvents.length)],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      style={{
                        padding: "14px 16px",
                        borderRadius: "var(--radius-16)",
                        border: "1px solid var(--color-border-muted)",
                        background: "var(--color-surface-raised)",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "var(--color-black-alpha-50)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {label}
                      </div>
                      <div style={{ marginTop: 8, fontSize: "14px", lineHeight: 1.35 }}>
                        {value}
                      </div>
                    </div>
                  ))}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      codeBlocks.length > 0 ? "minmax(0, 1.3fr) minmax(320px, 0.9fr)" : "1fr",
                    gap: "18px",
                    alignItems: "start",
                  }}
                >
                  {codeBlocks.length > 0 ? (
                    <div
                      style={{
                        border: "1px solid var(--color-border-muted)",
                        borderRadius: "var(--radius-20)",
                        overflow: "hidden",
                        background: "var(--color-surface)",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid var(--color-border-faint)",
                          fontSize: "13px",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "var(--color-black-alpha-50)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Current Drafts
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: "14px",
                          padding: "16px",
                          maxHeight: 600,
                          overflow: "auto",
                        }}
                      >
                        {codeBlocks.map((block) => (
                          <div key={block.label} style={{ display: "grid", gap: 8 }}>
                            <div
                              style={{
                                fontSize: "13px",
                                fontFamily: "var(--font-geist-mono), monospace",
                                color: "var(--color-heat-100)",
                              }}
                            >
                              {block.label}
                            </div>
                            <pre
                              style={{
                                margin: 0,
                                padding: "16px",
                                borderRadius: "var(--radius-16)",
                                background: "#111111",
                                color: "#f5f5f5",
                                overflow: "auto",
                                fontSize: "13px",
                                lineHeight: 1.45,
                                fontFamily: "var(--font-geist-mono), monospace",
                              }}
                            >
                              {block.value}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div
                    style={{
                      display: "grid",
                      gap: "18px",
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid var(--color-border-muted)",
                        borderRadius: "var(--radius-20)",
                        background: "var(--color-surface)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid var(--color-border-faint)",
                          fontSize: "13px",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "var(--color-black-alpha-50)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Current Summary
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: "16px",
                          overflow: "auto",
                          fontSize: "13px",
                          lineHeight: 1.45,
                          background: "var(--color-surface-raised)",
                          color: "#262626",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {renderJson(detail.presence?.summary ?? detail.session)}
                      </pre>
                    </div>

                    <div
                      style={{
                        border: "1px solid var(--color-border-muted)",
                        borderRadius: "var(--radius-20)",
                        background: "var(--color-surface)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid var(--color-border-faint)",
                          fontSize: "13px",
                          textTransform: "uppercase",
                          letterSpacing: "0.12em",
                          color: "var(--color-black-alpha-50)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Attempt Telemetry
                      </div>
                      <div style={{ maxHeight: 300, overflow: "auto", display: "grid" }}>
                        {detail.attemptEvents.map((event) => (
                          <div
                            key={event._id}
                            style={{
                              padding: "12px 14px",
                              borderBottom: "1px solid var(--color-border-faint)",
                              display: "grid",
                              gap: 4,
                            }}
                          >
                            <div
                              style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                            >
                              <strong style={{ fontSize: 13 }}>{event.eventType}</strong>
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontFamily: "var(--font-geist-mono), monospace",
                                  color: "var(--color-black-alpha-50)",
                                }}
                              >
                                {formatTime(event.createdAt)}
                              </span>
                            </div>
                            <div style={{ fontSize: "13px", color: "var(--color-black-alpha-50)" }}>
                              {event.status}
                              {typeof event.passCount === "number"
                                ? ` · pass ${event.passCount}`
                                : ""}
                              {typeof event.failCount === "number"
                                ? ` · fail ${event.failCount}`
                                : ""}
                            </div>
                          </div>
                        ))}
                        {detail.attemptEvents.length === 0 ? (
                          <div
                            style={{
                              padding: "16px",
                              fontSize: "14px",
                              color: "var(--color-black-alpha-50)",
                            }}
                          >
                            No attempt telemetry for this session yet.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    border: "1px solid var(--color-border-muted)",
                    borderRadius: "var(--radius-20)",
                    overflow: "hidden",
                    background: "var(--color-surface)",
                  }}
                >
                  <div
                    style={{
                      padding: "12px 14px",
                      borderBottom: "1px solid var(--color-border-faint)",
                      fontSize: "13px",
                      textTransform: "uppercase",
                      letterSpacing: "0.12em",
                      color: "var(--color-black-alpha-50)",
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    Replay Timeline
                  </div>
                  <div style={{ maxHeight: 420, overflow: "auto", display: "grid" }}>
                    {detail.replayEvents.map((event) => (
                      <div
                        key={event._id}
                        style={{
                          padding: "12px 14px",
                          borderBottom: "1px solid var(--color-border-faint)",
                          display: "grid",
                          gap: "8px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                          <div
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems: "center",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong style={{ fontSize: 13 }}>
                              {event.sequence}. {event.eventType}
                            </strong>
                            <span
                              style={{
                                fontSize: "11px",
                                fontFamily: "var(--font-geist-mono), monospace",
                                color: "var(--color-heat-100)",
                              }}
                            >
                              {event.screen}
                            </span>
                            {event.duplicateOfPrevious ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontFamily: "var(--font-geist-mono), monospace",
                                  color: "var(--color-black-alpha-50)",
                                }}
                              >
                                duplicate snapshot
                              </span>
                            ) : null}
                          </div>
                          <span
                            style={{
                              fontSize: "11px",
                              fontFamily: "var(--font-geist-mono), monospace",
                              color: "var(--color-black-alpha-50)",
                            }}
                          >
                            {formatTime(event.createdAt)}
                          </span>
                        </div>
                        <pre
                          style={{
                            margin: 0,
                            padding: 10,
                            borderRadius: "var(--radius-12)",
                            background: "var(--color-surface-raised)",
                            color: "#262626",
                            fontSize: "13px",
                            lineHeight: 1.4,
                            overflow: "auto",
                            fontFamily: "var(--font-geist-mono), monospace",
                          }}
                        >
                          {renderJson(event.summary ?? {})}
                        </pre>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ padding: 24, color: "var(--color-black-alpha-50)", fontSize: 14 }}>
                Select a session from the left to start spectating.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
