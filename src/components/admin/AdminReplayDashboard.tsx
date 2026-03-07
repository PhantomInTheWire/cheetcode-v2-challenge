"use client";

import {
  startTransition,
  useDeferredValue,
  useEffect,
  useEffectEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { formatRelative } from "./time-format";

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
  fingerprintProfile?: {
    sourceTrust: string;
    fingerprintId?: string;
    fingerprintSource?: string;
    automationVerdict?: string;
    automationConfidence?: string;
    changeCount: number;
    firstSeenAt: number;
    lastSeenAt: number;
    baselineSummary?: Record<string, unknown> | null;
    latestSummary?: Record<string, unknown> | null;
  } | null;
  identityLinks?: Array<{
    _id: string;
    identityKey: string;
    identityKind: string;
    route: string;
    screen?: string;
    firstSeenAt: number;
    lastSeenAt: number;
  }>;
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
  const detailControllerRef = useRef<AbortController | null>(null);
  const detailRequestIdRef = useRef(0);

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
    detailControllerRef.current?.abort();
    const controller = new AbortController();
    detailControllerRef.current = controller;
    const requestId = ++detailRequestIdRef.current;
    try {
      const res = await fetch(
        `/api/admin/replays?sessionId=${encodeURIComponent(sessionId)}&limit=180`,
        { cache: "no-store", signal: controller.signal },
      );
      if (controller.signal.aborted || requestId !== detailRequestIdRef.current) return;
      const data = (await res.json()) as ReplayDetail & { error?: string };
      if (!res.ok) throw new Error(data.error || "Failed to load session detail");
      if (controller.signal.aborted || requestId !== detailRequestIdRef.current) return;
      startTransition(() => {
        setDetail(data);
      });
      setError(null);
    } catch (nextError) {
      if (controller.signal.aborted || requestId !== detailRequestIdRef.current) return;
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
      detailRequestIdRef.current += 1;
      detailControllerRef.current?.abort();
      detailControllerRef.current = null;
      setDetail(null);
      return;
    }
    void loadDetail(deferredSessionId);
    const intervalId = window.setInterval(() => {
      void loadDetail(deferredSessionId);
    }, DETAIL_REFRESH_MS);
    return () => {
      window.clearInterval(intervalId);
      detailControllerRef.current?.abort();
      detailControllerRef.current = null;
    };
  }, [deferredSessionId]);

  const currentSnapshot = useMemo(
    () => detail?.replayEvents.findLast((event) => Boolean(event.snapshot))?.snapshot ?? null,
    [detail],
  );
  const codeBlocks = useMemo(() => codeBlocksFromSnapshot(currentSnapshot), [currentSnapshot]);
  const fingerprintSummary = (detail?.presence?.summary?.fingerprint ?? null) as {
    fingerprintSource?: string;
    environment?: { language?: string; languages?: string[]; timezone?: string };
    display?: { screenWidth?: number; screenHeight?: number; devicePixelRatio?: number };
    rendering?: { webGlVendor?: string; webGlRenderer?: string };
    automation?: {
      automationVerdict?: string;
      automationConfidence?: string;
      reasonCodes?: string[];
    };
  } | null;
  const fingerprintProfile = detail?.fingerprintProfile ?? null;
  const trustedIdentityLinks = detail?.identityLinks ?? [];

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
          maxWidth: 1600,
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
              Session <span style={{ color: "#fa5d19" }}>Replays</span>
            </h1>
            <p
              style={{
                fontSize: 14,
                color: "rgba(0,0,0,0.5)",
                margin: "4px 0 0",
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              }}
            >
              Live spectating and session replay
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
              href="/admin/identity"
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
              Identity
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

        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
          <div>
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                color: "rgba(0,0,0,0.4)",
                marginBottom: 12,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              Live Sessions ({sessions.length})
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {sessions.map((session) => {
                const selected = session.sessionId === selectedSessionId;
                return (
                  <button
                    key={session.sessionId}
                    onClick={() => setSelectedSessionId(session.sessionId)}
                    style={{
                      textAlign: "left",
                      border: "1px solid rgba(0,0,0,0.06)",
                      background: selected ? "rgba(250,93,25,0.08)" : "rgba(255,255,255,0.6)",
                      padding: "12px",
                      cursor: "pointer",
                      borderRadius: 10,
                      fontSize: 13,
                    }}
                  >
                    <div
                      style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}
                    >
                      <strong>@{session.github}</strong>
                      <span
                        style={{
                          fontSize: 11,
                          color: session.live ? "#1a9338" : "rgba(0,0,0,0.4)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {session.live ? "LIVE" : session.status.toUpperCase()}
                      </span>
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(0,0,0,0.5)",
                        fontFamily: "var(--font-geist-mono), monospace",
                      }}
                    >
                      L{session.level} · {session.screen} · {formatRelative(session.lastSeenAt)}
                    </div>
                  </button>
                );
              })}
              {sessions.length === 0 && (
                <div style={{ padding: 16, color: "rgba(0,0,0,0.4)", fontSize: 13 }}>
                  No sessions yet
                </div>
              )}
            </div>
          </div>

          <div>
            {detail ? (
              <div style={{ display: "grid", gap: 24 }}>
                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: 16,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 24, fontWeight: 500 }}>
                        @{detail.session?.github || "Unknown"}
                      </div>
                      <div
                        style={{
                          fontSize: 13,
                          color: "rgba(0,0,0,0.5)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {detail.presence
                          ? `${detail.presence.status} · ${detail.presence.screen}`
                          : "No presence"}
                      </div>
                    </div>
                    {detail.presence && (
                      <div
                        style={{
                          fontSize: 12,
                          color: "rgba(0,0,0,0.4)",
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Last seen {formatRelative(detail.presence.lastSeenAt)}
                      </div>
                    )}
                  </div>

                  {codeBlocks.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Current Draft
                      </div>
                      {codeBlocks.map((block) => (
                        <div key={block.label} style={{ marginBottom: 12 }}>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#fa5d19",
                              marginBottom: 4,
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {block.label}
                          </div>
                          <pre
                            style={{
                              margin: 0,
                              padding: 12,
                              background: "#111",
                              color: "#f5f5f5",
                              borderRadius: 8,
                              fontSize: 12,
                              lineHeight: 1.5,
                              overflow: "auto",
                              maxHeight: 300,
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {block.value}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}

                  {fingerprintSummary && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Unverified Client Hints
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          padding: 12,
                          background: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        <div>
                          client_unverified ·{" "}
                          {fingerprintSummary.automation?.automationVerdict ?? "unknown"} ·{" "}
                          {fingerprintSummary.automation?.automationConfidence ?? "n/a"} ·{" "}
                          {fingerprintSummary.fingerprintSource ?? "unknown"}
                        </div>
                        <div>
                          {fingerprintSummary.environment?.language ?? "lang?"} ·{" "}
                          {fingerprintSummary.environment?.timezone ?? "tz?"}
                        </div>
                        <div>
                          {fingerprintSummary.display?.screenWidth ?? "?"}x
                          {fingerprintSummary.display?.screenHeight ?? "?"} · dpr{" "}
                          {fingerprintSummary.display?.devicePixelRatio ?? "?"}
                        </div>
                        <div>
                          {fingerprintSummary.rendering?.webGlVendor || "no-webgl-vendor"} ·{" "}
                          {fingerprintSummary.rendering?.webGlRenderer || "no-webgl-renderer"}
                        </div>
                        {fingerprintSummary.automation?.reasonCodes?.length ? (
                          <div>{fingerprintSummary.automation.reasonCodes.join(", ")}</div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {fingerprintProfile && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Stored Client Hints
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          padding: 12,
                          background: "rgba(15,23,42,0.03)",
                          border: "1px solid rgba(15,23,42,0.08)",
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        <div>
                          {fingerprintProfile.sourceTrust} ·{" "}
                          {fingerprintProfile.automationVerdict ?? "unknown"} ·{" "}
                          {fingerprintProfile.automationConfidence ?? "n/a"}
                        </div>
                        <div>
                          {fingerprintProfile.fingerprintSource ?? "unknown"} · first{" "}
                          {formatTime(fingerprintProfile.firstSeenAt)} · last{" "}
                          {formatTime(fingerprintProfile.lastSeenAt)}
                        </div>
                        {fingerprintProfile.fingerprintId ? (
                          <div>id {fingerprintProfile.fingerprintId}</div>
                        ) : null}
                      </div>
                    </div>
                  )}

                  {trustedIdentityLinks.length > 0 && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Trusted Server Identity
                      </div>
                      <div
                        style={{
                          display: "grid",
                          gap: 8,
                          padding: 12,
                          background: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 10,
                          fontSize: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {trustedIdentityLinks.map((identity) => (
                          <div key={identity._id}>
                            {identity.identityKind} · {identity.identityKey} · {identity.route}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {fingerprintProfile?.baselineSummary && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        First Client Hint Payload
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 12,
                          background: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 10,
                          fontSize: 12,
                          overflow: "auto",
                          maxHeight: 240,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {renderJson(fingerprintProfile.baselineSummary)}
                      </pre>
                    </div>
                  )}

                  {fingerprintProfile?.latestSummary && (
                    <div style={{ marginBottom: 24 }}>
                      <div
                        style={{
                          fontSize: 11,
                          textTransform: "uppercase",
                          color: "rgba(0,0,0,0.4)",
                          marginBottom: 12,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        Latest Client Hint Payload
                      </div>
                      <pre
                        style={{
                          margin: 0,
                          padding: 12,
                          background: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 10,
                          fontSize: 12,
                          overflow: "auto",
                          maxHeight: 240,
                          fontFamily: "var(--font-geist-mono), monospace",
                        }}
                      >
                        {renderJson(fingerprintProfile.latestSummary)}
                      </pre>
                    </div>
                  )}

                  <div
                    style={{
                      fontSize: 11,
                      textTransform: "uppercase",
                      color: "rgba(0,0,0,0.4)",
                      marginBottom: 12,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    Timeline ({detail.replayEvents.length} events)
                  </div>
                  <div style={{ display: "grid", gap: 8, maxHeight: 600, overflow: "auto" }}>
                    {detail.replayEvents.map((event) => (
                      <div
                        key={event._id}
                        style={{
                          background: "rgba(255,255,255,0.6)",
                          border: "1px solid rgba(0,0,0,0.06)",
                          borderRadius: 10,
                          padding: 12,
                          fontSize: 13,
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: 4,
                          }}
                        >
                          <div>
                            <strong>
                              {event.sequence}. {event.eventType}
                            </strong>
                            <span
                              style={{
                                marginLeft: 8,
                                color: "#fa5d19",
                                fontSize: 12,
                                fontFamily: "var(--font-geist-mono), monospace",
                              }}
                            >
                              {event.screen}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: 12,
                              color: "rgba(0,0,0,0.4)",
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {formatTime(event.createdAt)}
                          </span>
                        </div>
                        {event.summary && (
                          <pre
                            style={{
                              margin: "8px 0 0",
                              padding: 8,
                              background: "rgba(0,0,0,0.02)",
                              borderRadius: 6,
                              fontSize: 11,
                              overflow: "auto",
                              maxHeight: 200,
                              fontFamily: "var(--font-geist-mono), monospace",
                            }}
                          >
                            {renderJson(event.summary)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div
                style={{ padding: 40, textAlign: "center", color: "rgba(0,0,0,0.4)", fontSize: 14 }}
              >
                Select a session to view details
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
