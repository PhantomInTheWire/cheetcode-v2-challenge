"use client";

import { useEffect } from "react";
import Image from "next/image";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f9f9f9",
          fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
          position: "relative",
          overflow: "hidden",
          margin: 0,
        }}
      >
        {/* Grid background */}
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
              "radial-gradient(ellipse at top left, rgba(250,93,25,0.06) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(250,93,25,0.04) 0%, transparent 50%)",
          }}
        />

        <div
          style={{
            width: "100%",
            maxWidth: 640,
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
            <svg
              width="22"
              height="22"
              viewBox="0 0 600 600"
              preserveAspectRatio="xMidYMid meet"
              style={{ display: "inline-block", flexShrink: 0 }}
              dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
            />
            <Image
              src="/images/errors/global-error.svg"
              alt="Global Error Illustration"
              width={200}
              height={120}
              priority
            />
          </div>
          <h2
            style={{
              margin: "14px 0 8px",
              color: "#262626",
              fontSize: 30,
              fontWeight: 500,
              letterSpacing: -0.3,
            }}
          >
            Global app error
          </h2>
          <p style={{ margin: 0, color: "rgba(0,0,0,0.4)", fontSize: 14 }}>
            A root-level failure occurred. Retry to reinitialize app state.
          </p>
          <button
            onClick={() => reset()}
            style={{
              marginTop: 20,
              borderRadius: 10,
              height: 44,
              padding: "0 16px",
              fontSize: 14,
              fontWeight: 450,
              fontFamily: "system-ui, -apple-system, sans-serif",
              cursor: "pointer",
              background: "#ff4c00",
              color: "white",
              border: "1px solid #f25515",
              boxShadow:
                "inset 0px -6px 12px 0px rgba(250,25,25,0.2), 0px 2px 4px 0px rgba(250,93,25,0.12), 0px 1px 1px 0px rgba(250,93,25,0.12), 0px 0.5px 0.5px 0px rgba(250,93,25,0.16), 0px 0.25px 0.25px 0px rgba(250,93,25,0.2)",
              transition: "all 0.2s cubic-bezier(0.25,0.1,0.25,1), scale 0.1s, box-shadow 0.1s",
            }}
          >
            Reinitialize App
          </button>
        </div>
      </body>
    </html>
  );
}
