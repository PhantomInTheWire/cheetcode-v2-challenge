"use client";

import { useState } from "react";

export function CommandBlock({
  command,
  onCopy,
}: {
  command: string;
  onCopy: (text: string) => void | Promise<void>;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await onCopy(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        margin: "10px 0 0",
        background: "rgba(0,0,0,0.02)",
        border: "1px solid #e8e8e8",
        borderRadius: 12,
        padding: "12px 14px",
        position: "relative",
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      <button
        onClick={handleCopy}
        aria-label="Copy command"
        title="Copy command"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          height: 24,
          padding: "0 8px",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          background: copied ? "rgba(26,147,56,0.08)" : "rgba(0,0,0,0.04)",
          border: "1px solid",
          borderColor: copied ? "rgba(26,147,56,0.2)" : "#e8e8e8",
          cursor: "pointer",
          color: copied ? "#1a9338" : "rgba(0,0,0,0.4)",
          fontSize: 10,
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
          transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
          zIndex: 5,
        }}
      >
        {copied ? (
          "Copied"
        ) : (
          <>
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
            >
              <rect x="9" y="9" width="11" height="11" rx="2" />
              <rect x="4" y="4" width="11" height="11" rx="2" />
            </svg>
            <span>Copy</span>
          </>
        )}
      </button>
      <pre
        style={{
          margin: 0,
          fontSize: 12,
          color: "#262626",
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
          overflowX: "auto",
          paddingRight: 60,
        }}
      >
        <code>{command}</code>
      </pre>
    </div>
  );
}
