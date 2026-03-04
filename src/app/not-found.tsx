import Link from "next/link";
import { COLORS } from "@/lib/theme";

const shellStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  padding: "24px",
  background:
    "radial-gradient(circle at top, rgba(250,93,25,0.12) 0%, rgba(249,249,249,1) 45%, rgba(249,249,249,1) 100%)",
  fontFamily: "var(--font-geist-mono), monospace",
};

const cardStyle: React.CSSProperties = {
  width: "100%",
  maxWidth: "560px",
  borderRadius: "16px",
  padding: "28px",
  background: COLORS.BG_CARD,
  border: `1px solid ${COLORS.BORDER_LIGHT}`,
  boxShadow: "0 10px 24px rgba(38, 38, 38, 0.08)",
};

const linkStyle: React.CSSProperties = {
  display: "inline-flex",
  marginTop: "18px",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "10px",
  height: "42px",
  padding: "0 14px",
  textDecoration: "none",
  background: COLORS.PRIMARY,
  color: COLORS.TEXT_WHITE,
  fontWeight: 700,
};

export default function NotFound() {
  return (
    <div style={shellStyle}>
      <div style={cardStyle}>
        <pre
          style={{ margin: 0, color: COLORS.PRIMARY, fontSize: 13, lineHeight: 1.2 }}
        >{`+--------------+
| 404 NOT FOUND|
+--------------+`}</pre>
        <h2
          style={{ margin: "12px 0 8px", color: COLORS.TEXT_DARK, fontSize: 28, fontWeight: 800 }}
        >
          This route does not exist
        </h2>
        <p style={{ margin: 0, color: COLORS.TEXT_MUTED, fontSize: 14 }}>
          The URL is invalid or the resource has moved.
        </p>
        <Link href="/" style={linkStyle}>
          Back To CTF Home
        </Link>
      </div>
    </div>
  );
}
