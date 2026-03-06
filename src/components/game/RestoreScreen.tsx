"use client";

import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { AnimatedLandingDecor, BrailleSpinner } from "./decor";

export function RestoreScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "24px",
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

      <AnimatedLandingDecor />

      <div
        style={{
          width: "min(520px, 100%)",
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 20,
          padding: "48px 32px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <svg
            width="32"
            height="32"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block" }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
        </div>
        <p
          style={{
            margin: 0,
            fontSize: 20,
            color: "#262626",
            fontWeight: 500,
            letterSpacing: -0.3,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Restoring session
        </p>
        <p
          style={{
            margin: "12px 0 24px",
            fontSize: 14,
            color: "rgba(0,0,0,0.4)",
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            lineHeight: 1.5,
          }}
        >
          Returning you to your active level with saved progress.
        </p>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            fontSize: 12,
            color: "rgba(0,0,0,0.3)",
            fontFamily: "var(--font-geist-mono), monospace",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <BrailleSpinner />
          <span>[ Status ] Synchronizing State</span>
        </div>
      </div>
    </div>
  );
}
