"use client";

import { BrailleSpinner } from "@/components/game/decor";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

type GameLoadingScreenProps = {
  label?: string;
};

export function GameLoadingScreen({ label = "⣟ Loading" }: GameLoadingScreenProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f9f9f9",
        color: "#262626",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: 0.5,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "8px 8px",
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse at top left, rgba(250,93,25,0.06) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.04) 0%, transparent 50%)
          `,
        }}
      />

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 1,
          width: "min(240px, calc(100vw - 48px))",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            textAlign: "center",
            gap: 12,
          }}
        >
          <svg
            aria-hidden="true"
            width="148"
            height="148"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{
              display: "block",
              filter: "drop-shadow(0 14px 32px rgba(250,93,25,0.18))",
              animation: "firecrawl-loader-float 1.8s ease-in-out infinite",
              transformOrigin: "50% 50%",
            }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
          <div
            style={{
              fontSize: 13,
              lineHeight: "18px",
              color: "rgba(0,0,0,0.45)",
              fontFamily: "var(--font-geist-mono), monospace",
              letterSpacing: 0.2,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
            }}
          >
            <BrailleSpinner />
            <span>{label.replace(/^[^\s]+\s*/, "")}</span>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes firecrawl-loader-float {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-6px) scale(1.015); }
        }
      `}</style>
    </div>
  );
}
