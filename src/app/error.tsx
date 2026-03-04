"use client";

import { useEffect } from "react";
import Image from "next/image";
import { COLORS } from "@/lib/theme";

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at top, rgba(250,93,25,0.14) 0%, rgba(249,249,249,1) 45%, rgba(249,249,249,1) 100%)",
  fontFamily: "var(--font-geist-mono), monospace",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "620px",
  borderRadius: "16px",
  padding: "32px",
  background: COLORS.BG_CARD,
  border: `1px solid ${COLORS.BORDER_LIGHT}`,
  boxShadow: "0 12px 28px rgba(38, 38, 38, 0.08)",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "20px",
  borderRadius: "10px",
  border: "none",
  height: "44px",
  padding: "0 16px",
  background: COLORS.PRIMARY,
  color: COLORS.TEXT_WHITE,
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 2px 4px rgba(250, 93, 25, 0.35)",
  transition: "0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
};

export default function Error({
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
    <div style={shellStyle}>
      <div style={cardStyle}>
        <div style={{ marginBottom: "20px" }}>
          <Image
            src="/images/errors/route-error.svg"
            alt="Route Error Illustration"
            width={200}
            height={120}
            priority
          />
        </div>
        <h2
          style={{ margin: "14px 0 8px", color: COLORS.TEXT_DARK, fontSize: 28, fontWeight: 800 }}
        >
          Something broke in this route
        </h2>
        <p style={{ margin: 0, color: COLORS.TEXT_MUTED, fontSize: 14 }}>
          The page hit an unexpected error. Retry to recover without losing the session.
        </p>
        <button onClick={() => reset()} style={buttonStyle}>
          Retry Route
        </button>
      </div>
    </div>
  );
}
