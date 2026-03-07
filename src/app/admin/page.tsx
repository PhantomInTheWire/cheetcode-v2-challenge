import { requireAdminPageGithub } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const github = await requireAdminPageGithub();

  return (
    <div
      style={{
        height: "100vh",
        background: "#f9f9f9",
        color: "#262626",
        position: "relative",
        overflow: "hidden",
      }}
    >
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

      <div
        style={{
          position: "relative",
          zIndex: 10,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: 480,
            textAlign: "center",
            opacity: 1,
            transform: "translateY(0)",
          }}
        >
          <h1
            style={{
              fontSize: 52,
              fontWeight: 500,
              lineHeight: "56px",
              letterSpacing: -0.52,
              color: "#262626",
              margin: 0,
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            Admin <span style={{ color: "#fa5d19" }}>Console</span>
          </h1>
          <p
            style={{
              fontSize: 16,
              lineHeight: "24px",
              color: "rgba(0,0,0,0.5)",
              margin: "12px 0 0",
              fontWeight: 400,
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            Monitor sessions, manage abuse, review performance
          </p>

          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "4px 12px 4px 4px",
              background: "rgba(0,0,0,0.04)",
              borderRadius: 999,
              marginTop: 24,
            }}
          >
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "rgba(250,93,25,0.12)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "#fa5d19",
              }}
            >
              {github[0]?.toUpperCase()}
            </div>
            <span
              style={{
                fontSize: 13,
                fontWeight: 450,
                color: "#262626",
                fontFamily: "var(--font-geist-mono), monospace",
              }}
            >
              {github}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              justifyContent: "center",
              marginTop: 40,
            }}
          >
            <a
              href="/admin/replays"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 40,
                minWidth: 150,
                padding: "0 20px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 450,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                border: "none",
                background: "#ff4c00",
                color: "#ffffff",
                textDecoration: "none",
                boxShadow: `
                  inset 0px -6px 12px 0px rgba(250,25,25,0.2),
                  0px 2px 4px 0px rgba(250,93,25,0.12),
                  0px 1px 1px 0px rgba(250,93,25,0.12),
                  0px 0.5px 0.5px 0px rgba(250,93,25,0.16),
                  0px 0.25px 0.25px 0px rgba(250,93,25,0.2)
                `,
              }}
            >
              Session Replays
            </a>
            <a
              href="/admin/identity"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                height: 40,
                minWidth: 150,
                padding: "0 20px",
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 450,
                fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                cursor: "pointer",
                transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
                border: "none",
                background: "rgba(0,0,0,0.04)",
                color: "#262626",
                textDecoration: "none",
              }}
            >
              Identity Graph
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
