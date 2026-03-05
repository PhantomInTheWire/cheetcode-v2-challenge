import Link from "next/link";
import Image from "next/image";
import { FIRECRAWL_FLAME_SVG } from "@/components/game/firecrawl-flame";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f9f9f9",
        fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
        position: "relative",
        overflow: "hidden",
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
            "radial-gradient(ellipse at top left, rgba(250,93,25,0.04) 0%, transparent 50%), radial-gradient(ellipse at bottom right, rgba(250,93,25,0.02) 0%, transparent 50%)",
        }}
      />

      <div
        style={{
          width: "100%",
          maxWidth: 560,
          borderRadius: 16,
          padding: 28,
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 600 600"
            preserveAspectRatio="xMidYMid meet"
            style={{ display: "inline-block", flexShrink: 0 }}
            dangerouslySetInnerHTML={{ __html: FIRECRAWL_FLAME_SVG }}
          />
          <Image
            src="/images/errors/not-found.svg"
            alt="Not Found Illustration"
            width={200}
            height={120}
            priority
          />
        </div>
        <h2
          style={{
            margin: "12px 0 8px",
            color: "#262626",
            fontSize: 28,
            fontWeight: 500,
            letterSpacing: -0.3,
          }}
        >
          This route does not exist
        </h2>
        <p style={{ margin: 0, color: "rgba(0,0,0,0.4)", fontSize: 14 }}>
          The URL is invalid or the resource has moved.
        </p>
        <Link
          href="/"
          className="btn-heat"
          style={{
            display: "inline-flex",
            marginTop: 18,
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 10,
            height: 42,
            padding: "0 14px",
            textDecoration: "none",
            fontSize: 14,
            fontWeight: 450,
            fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
          }}
        >
          Back To CTF Home
        </Link>
      </div>
    </div>
  );
}
