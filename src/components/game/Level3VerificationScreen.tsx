"use client";

import React, { useEffect, useState } from "react";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";
import { AnimatedLandingDecor } from "@/components/game/decor";
import { type ResultsData } from "@/lib/gameTypes";

type Level3VerificationScreenProps = {
  results: ResultsData;
  onContinue: () => void;
};

export function Level3VerificationScreen({ results, onContinue }: Level3VerificationScreenProps) {
  const [isLoaded, setIsLoaded] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const validation = results.validation;
  const passedCount = validation?.results.filter((r) => r.correct).length ?? 0;
  const totalCount = validation?.results.length ?? 0;
  const allPassed = passedCount === totalCount && validation?.compiled;

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "80px 24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Background Elements ── */}
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
          background: `
            radial-gradient(ellipse at top left, rgba(250,93,25,0.05) 0%, transparent 50%),
            radial-gradient(ellipse at bottom right, rgba(250,93,25,0.03) 0%, transparent 50%)
          `,
        }}
      />
      <AnimatedLandingDecor />

      {/* Decorative labels */}
      {[
        { text: "[ VERIFYING ]", top: 32, left: 24 },
        { text: "[ LEVEL_3 ]", bottom: 32, left: 24 },
        { text: "[ SYSTEMS ]", top: 32, right: 24 },
        { text: "[ COMPILE ]", bottom: 32, right: 24 },
      ].map((label, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            fontSize: 12,
            fontFamily: "var(--font-geist-mono), monospace",
            color: "rgba(0,0,0,0.12)",
            pointerEvents: "none",
            userSelect: "none",
            zIndex: 2,
            textAlign: "center",
            ...label,
          }}
        >
          {label.text}
        </div>
      ))}

      <div
        style={{
          width: "100%",
          maxWidth: 720,
          textAlign: "center",
          position: "relative",
          zIndex: 10,
          opacity: isLoaded ? 1 : 0,
          transform: isLoaded ? "translateY(0)" : "translateY(12px)",
          transition: "all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            marginBottom: 40,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "inline-block", flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
            />
            <span
              style={{
                fontSize: 14,
                fontWeight: 450,
                color: "#262626",
                letterSpacing: 0.5,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              [ LEVEL 3 VERIFICATION ]
            </span>
          </div>
          <h1
            style={{
              fontSize: 56,
              fontWeight: 500,
              margin: 0,
              lineHeight: 1,
              letterSpacing: -1.5,
              color: allPassed ? "#1a9338" : "#262626",
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
            }}
          >
            {allPassed ? "CLEARED" : validation?.compiled ? "PARTIAL PASS" : "FAILED"}
          </h1>
        </div>

        <div
          style={{
            textAlign: "left",
            background: "#ffffff",
            border: "1px solid #e8e8e8",
            borderRadius: 20,
            padding: "32px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
            marginBottom: 32,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 24,
              borderBottom: "1px solid #f0f0f0",
              paddingBottom: 16,
            }}
          >
            <span
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#262626",
                textTransform: "uppercase",
                letterSpacing: 0.5,
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              [ VERIFICATION_RESULTS ]
            </span>
            <span
              style={{
                fontSize: 12,
                color: allPassed ? "#1a9338" : "#dc2626",
                fontFamily: "var(--font-geist-mono), monospace",
                fontWeight: 600,
              }}
            >
              {passedCount}/{totalCount} CHECKS PASSED
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              maxHeight: 280,
              overflowY: "auto",
              paddingRight: 8,
              marginRight: -8,
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 13,
                fontFamily: "var(--font-geist-mono), monospace",
                paddingBottom: 12,
                borderBottom: "1px solid #f0f0f0",
                marginBottom: 4,
              }}
            >
              <span style={{ color: "rgba(0,0,0,0.45)" }}>[ BUILD STATUS ]</span>
              <span
                style={{
                  fontWeight: 600,
                  color: validation?.compiled ? "#1a9338" : "#dc2626",
                }}
              >
                {validation?.compiled ? "SUCCESS" : "FAILED"}
              </span>
            </div>

            {validation?.results.map((r, i) => {
              const testName = r.name || r.problemId.split(":").pop() || r.problemId;
              return (
                <div
                  key={r.problemId + i}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: 12,
                    fontFamily: "var(--font-geist-mono), monospace",
                    padding: "6px 0",
                  }}
                >
                  <span
                    style={{
                      color: "#262626",
                      flex: 1,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      fontWeight: 450,
                    }}
                  >
                    {testName}
                  </span>
                  <span
                    style={{
                      fontWeight: 600,
                      fontSize: 10,
                      letterSpacing: "0.05em",
                      color: r.correct ? "#1a9338" : "#dc2626",
                      background: r.correct ? "rgba(26,147,56,0.08)" : "rgba(220,38,38,0.08)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      marginLeft: 16,
                    }}
                  >
                    {r.correct ? "PASS" : "FAIL"}
                  </span>
                </div>
              );
            })}
          </div>

          {!validation?.compiled && validation?.error && (
            <div
              style={{
                marginTop: 12,
                padding: "16px",
                background: "rgba(220,38,38,0.05)",
                borderRadius: 8,
                border: "1px solid rgba(220,38,38,0.1)",
                fontSize: 12,
                color: "#dc2626",
                fontFamily: "var(--font-geist-mono), monospace",
                whiteSpace: "pre-wrap",
                overflowX: "auto",
              }}
            >
              {validation.error}
            </div>
          )}
        </div>

        <button
          className="btn-heat"
          onClick={onContinue}
          style={{
            width: "100%",
            maxWidth: 400,
            height: 52,
            borderRadius: 16,
            fontSize: 16,
            fontWeight: 500,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          CONTINUE
        </button>
      </div>

      <div
        style={{
          marginTop: 60,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
          fontSize: 12,
          color: "rgba(0,0,0,0.16)",
          fontFamily: "var(--font-geist-mono), monospace",
          position: "relative",
          zIndex: 10,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>v2.0</span>
      </div>
    </div>
  );
}
