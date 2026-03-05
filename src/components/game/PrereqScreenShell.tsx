"use client";

import type { ReactNode } from "react";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

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
        background: "#f9f9f9",
        padding: 24,
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Grid background ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.4,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "8px 8px",
        }}
      />
      {/* ── Radial heat gradient ── */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse at top left, rgba(250,93,25,0.04) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.02) 0%, transparent 50%)
          `,
        }}
      />

      <div
        style={{
          width,
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 16,
          padding: "28px 28px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
          position: "relative",
          zIndex: 1,
        }}
      >
        {/* Title with flame */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
          <h2
            style={{
              margin: 0,
              color: "#262626",
              fontSize: 20,
              fontWeight: 500,
              letterSpacing: -0.3,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {title}
          </h2>
        </div>
        {children}
        <div style={{ marginTop: 20, display: "flex", gap: 8 }}>{actions}</div>
      </div>
    </div>
  );
}
