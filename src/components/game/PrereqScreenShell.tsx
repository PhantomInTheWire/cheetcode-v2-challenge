"use client";

import type { ReactNode } from "react";

export function PrereqScreenShell({
  width,
  title,
  children,
  actions,
}: {
  width: string;
  title: string;
  children: ReactNode;
  actions: ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(140deg, #fff7f2 0%, #fff 100%)",
        padding: 24,
        fontFamily: "'SF Mono', 'Fira Code', var(--font-geist-mono), monospace",
      }}
    >
      <div
        style={{
          width,
          background: "#fff",
          border: "1px solid #ffd5c0",
          borderRadius: 16,
          padding: 24,
          boxShadow: "0 12px 30px rgba(250, 93, 25, 0.08)",
        }}
      >
        <h2 style={{ margin: 0, color: "#fa5d19", fontSize: 24, fontWeight: 800 }}>{title}</h2>
        {children}
        <div style={{ marginTop: 20, display: "flex", gap: 10 }}>{actions}</div>
      </div>
    </div>
  );
}
