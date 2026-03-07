"use client";

import type { CSSProperties, ReactNode } from "react";
import Image from "next/image";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

type StatusPageShellProps = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
  imageWidth?: number;
  imageHeight?: number;
  includeFlame?: boolean;
  maxWidth?: number;
  action?: ReactNode;
  bodyStyle?: CSSProperties;
};

export function StatusPageShell({
  title,
  description,
  imageSrc,
  imageAlt,
  imageWidth = 200,
  imageHeight = 120,
  includeFlame = false,
  maxWidth = 620,
  action,
  bodyStyle,
}: StatusPageShellProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f9f9f9",
        fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
        ...bodyStyle,
      }}
    >
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
          background:
            "radial-gradient(ellipse at top left, rgba(250,93,25,0.05) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(250,93,25,0.03) 0%, transparent 50%)",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth,
          borderRadius: 16,
          padding: 32,
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
          {includeFlame ? (
            <svg
              width="22"
              height="22"
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "inline-block", flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
            />
          ) : null}
          <Image src={imageSrc} alt={imageAlt} width={imageWidth} height={imageHeight} priority />
        </div>
        <h2
          style={{
            margin: "14px 0 8px",
            color: "#262626",
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: -0.3,
          }}
        >
          {title}
        </h2>
        <p style={{ margin: 0, color: "rgba(0,0,0,0.4)", fontSize: 14 }}>{description}</p>
        {action}
      </div>
    </div>
  );
}
