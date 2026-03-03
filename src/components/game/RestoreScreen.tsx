"use client";

export function RestoreScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f9f9f9",
        padding: "24px",
        fontFamily: "var(--font-geist-mono), monospace",
      }}
    >
      <div
        style={{
          width: "min(520px, 100%)",
          background: "#ffffff",
          border: "1px solid #e5e5e5",
          borderRadius: 18,
          padding: "28px 24px",
          textAlign: "center",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <p style={{ margin: 0, fontSize: 14, color: "#fa5d19", fontWeight: 800 }}>
          Restoring session
        </p>
        <p style={{ margin: "10px 0 0", fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
          Returning you to your active level with saved progress.
        </p>
      </div>
    </div>
  );
}
