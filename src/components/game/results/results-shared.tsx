"use client";

import React from "react";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { AnimatedLandingDecor } from "@/components/game/decor";

type ResultStat = {
  label: string;
  value: string;
  tone?: string;
};

export const RESULTS_LAYOUT = {
  layoutWidth: 960,
  heroWidth: 680,
  metricsWidth: 740,
  panelWidth: 740,
};

export const RESULTS_INPUT_STYLE: React.CSSProperties = {
  height: 48,
  padding: "0 16px",
  boxSizing: "border-box",
  borderRadius: 10,
  border: "1px solid #e8e8e8",
  fontSize: 14,
  fontFamily: "var(--font-geist-mono), monospace",
  outline: "none",
  background: "#ffffff",
  color: "#262626",
  transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
};

export const RESULTS_FIELD_LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 500,
  color: "rgba(0,0,0,0.4)",
  marginBottom: 8,
  fontFamily: "var(--font-geist-mono), monospace",
  textTransform: "uppercase",
};

const RESULTS_SURFACE_STYLE: React.CSSProperties = {
  background: "transparent",
  border: "none",
  boxShadow: "none",
};

export function ResultsBackdrop({
  labels = [
    { text: "[ RESULTS ]", top: 32, left: 24 },
    { text: "[ DETAILS ]", top: 32, right: 24 },
  ],
}: {
  labels?: Array<{ text: string; top?: number; right?: number; bottom?: number; left?: number }>;
}) {
  const decorLabelStyle: React.CSSProperties = {
    fontSize: 12,
    fontFamily: "var(--font-geist-mono), monospace",
    color: "rgba(0,0,0,0.12)",
    pointerEvents: "none",
    userSelect: "none",
    zIndex: 2,
    textAlign: "center",
  };

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
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
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          opacity: 0.45,
          backgroundImage: `
            linear-gradient(rgba(0,0,0,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(0,0,0,0.04) 1px, transparent 1px)
          `,
          backgroundSize: "12px 12px",
        }}
      />
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          pointerEvents: "none",
          background: `
            radial-gradient(ellipse at top left, rgba(250,93,25,0.05) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.03) 0%, transparent 55%)
          `,
        }}
      />
      <AnimatedLandingDecor />
      {labels.map((label, i) => (
        <div key={i} style={{ ...decorLabelStyle, position: "absolute", ...label }}>
          {label.text}
        </div>
      ))}
    </>
  );
}

export function ResultsHero({
  title,
  subtitle,
  titleColor = "#262626",
  subtitleColor = "rgba(0,0,0,0.64)",
  maxWidth = RESULTS_LAYOUT.heroWidth,
  flameSize = 52,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  titleColor?: string;
  subtitleColor?: string;
  maxWidth?: number;
  flameSize?: number;
}) {
  return (
    <div
      style={{
        width: "100%",
        maxWidth,
        textAlign: "center",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
          marginBottom: subtitle ? 24 : 0,
        }}
      >
        <svg
          width={flameSize}
          height={flameSize}
          viewBox="0 0 600 600"
          preserveAspectRatio="xMidYMid meet"
          style={{ display: "inline-block", flexShrink: 0 }}
          dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
        />
        <h1
          style={{
            margin: 0,
            fontSize: 72,
            fontWeight: 600,
            lineHeight: 1,
            letterSpacing: "-0.05em",
            color: titleColor,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {title}
        </h1>
      </div>
      {subtitle ? (
        <p
          style={{
            margin: 0,
            fontSize: 24,
            color: subtitleColor,
            lineHeight: 1.5,
            fontWeight: 500,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

export function ResultsStatsGrid({
  stats,
  maxWidth = RESULTS_LAYOUT.metricsWidth,
  animatedStyles,
}: {
  stats: ResultStat[];
  maxWidth?: number;
  animatedStyles?: React.CSSProperties[];
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: 16,
        width: "100%",
        maxWidth,
        margin: "0 auto",
      }}
    >
      {stats.map((item, index) => (
        <div
          key={item.label}
          style={{
            padding: "8px 12px",
            minHeight: "auto",
            borderRadius: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            ...RESULTS_SURFACE_STYLE,
            ...(animatedStyles?.[index] ?? {}),
          }}
        >
          <div
            style={{
              fontSize: 11,
              color: "rgba(0,0,0,0.35)",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            [ {item.label} ]
          </div>
          <div
            style={{
              fontSize: 32,
              fontWeight: 450,
              color: item.tone ?? "#262626",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              letterSpacing: "-0.02em",
              lineHeight: 1,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}

export function ResultsPanel({
  children,
  maxWidth = RESULTS_LAYOUT.panelWidth,
  style,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        borderRadius: 0,
        padding: 0,
        width: "100%",
        maxWidth,
        margin: "0 auto",
        textAlign: "left",
        ...RESULTS_SURFACE_STYLE,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
