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
        background: "#fff",
        border: "1px solid #ffd5c0",
        borderRadius: 8,
        padding: "10px 12px",
        overflowX: "auto",
        position: "relative",
      }}
    >
      <button
        onClick={() => void onCopy(command)}
        className="btn-ghost"
        aria-label="Copy command"
        title="Copy command"
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          height: 24,
          width: 24,
          padding: 0,
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
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
