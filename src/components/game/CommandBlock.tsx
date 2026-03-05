"use client";

export function CommandBlock({
  command,
  onCopy,
}: {
  command: string;
  onCopy: (text: string) => void | Promise<void>;
}) {
  return (
    <pre
      style={{
        margin: "8px 0 0",
        fontSize: 12,
        color: "#262626",
        whiteSpace: "pre-wrap",
        background: "#fafafa",
        border: "1px solid #e8e8e8",
        borderRadius: 10,
        padding: "10px 12px",
        overflowX: "auto",
        position: "relative",
        fontFamily: "var(--font-geist-mono), monospace",
        lineHeight: 1.6,
      }}
    >
      <button
        onClick={() => void onCopy(command)}
        aria-label="Copy command"
        title="Copy command"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          height: 26,
          width: 26,
          padding: 0,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.04)",
          border: "1px solid #e8e8e8",
          cursor: "pointer",
          color: "rgba(0,0,0,0.4)",
          transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
        }}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <rect x="4" y="4" width="11" height="11" rx="2" />
        </svg>
      </button>
      <code>{command}</code>
    </pre>
  );
}
