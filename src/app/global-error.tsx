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
    "radial-gradient(circle at top, rgba(250,93,25,0.18) 0%, rgba(249,249,249,1) 42%, rgba(249,249,249,1) 100%)",
  fontFamily: "var(--font-geist-mono), monospace",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "640px",
  borderRadius: "16px",
  padding: "32px",
  background: COLORS.BG_CARD,
  border: `1px solid ${COLORS.BORDER_LIGHT}`,
  boxShadow: "0 14px 30px rgba(38, 38, 38, 0.1)",
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
      <body style={shellStyle}>
        <div style={cardStyle}>
          <div style={{ marginBottom: "20px" }}>
            <Image
              src="/images/errors/global-error.svg"
              alt="Global Error Illustration"
              width={200}
              height={120}
              priority
            />
          </div>
          <h2
            style={{ margin: "14px 0 8px", color: COLORS.TEXT_DARK, fontSize: 30, fontWeight: 800 }}
          >
            Global app error
          </h2>
          <p style={{ margin: 0, color: COLORS.TEXT_MUTED, fontSize: 14 }}>
            A root-level failure occurred. Retry to reinitialize app state.
          </p>
          <button onClick={() => reset()} style={buttonStyle}>
            Reinitialize App
          </button>
        </div>
      </body>
    </html>
  );
}
