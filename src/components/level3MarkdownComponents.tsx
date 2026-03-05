import type { ReactNode } from "react";
import { COLORS } from "@/lib/theme";

export const L3_MARKDOWN_COMPONENTS = {
  h1: ({ ...props }) => (
    <h1
      style={{
        fontSize: 28,
        fontWeight: 500,
        letterSpacing: -0.8,
        margin: "0 0 14px",
        color: COLORS.TEXT_DARK,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
  h2: ({ ...props }) => (
    <h2
      style={{
        fontSize: 20,
        fontWeight: 500,
        margin: "24px 0 10px",
        color: COLORS.PRIMARY,
        letterSpacing: -0.4,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
  h3: ({ ...props }) => (
    <h3
      style={{
        fontSize: 16,
        fontWeight: 500,
        margin: "18px 0 8px",
        color: COLORS.TEXT_DARK,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
  p: ({ ...props }) => (
    <p
      style={{
        margin: "0 0 14px",
        color: "rgba(0,0,0,0.72)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
  ul: ({ ...props }) => <ul style={{ margin: "0 0 14px", paddingLeft: 22 }} {...props} />,
  ol: ({ ...props }) => <ol style={{ margin: "0 0 14px", paddingLeft: 22 }} {...props} />,
  li: ({ ...props }) => (
    <li
      style={{
        margin: "0 0 6px",
        color: "rgba(0,0,0,0.72)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
  strong: ({ ...props }) => (
    <strong style={{ color: COLORS.TEXT_DARK, fontWeight: 500 }} {...props} />
  ),
  code: ({ className, children, ...props }: { className?: string; children?: ReactNode }) => {
    const inline = !className;
    if (inline) {
      return (
        <code
          style={{
            background: "rgba(250, 93, 25, 0.08)",
            border: "1px solid rgba(250, 93, 25, 0.16)",
            borderRadius: 6,
            padding: "2px 6px",
            color: COLORS.PRIMARY,
            fontSize: "0.92em",
            fontFamily: "var(--font-geist-mono), monospace",
          }}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        style={{
          display: "block",
          background: "linear-gradient(180deg, #fffaf7 0%, #fff 100%)",
          border: "1px solid rgba(250, 93, 25, 0.18)",
          borderRadius: 12,
          padding: 14,
          whiteSpace: "pre-wrap",
          overflowX: "auto",
          color: COLORS.TEXT_DARK,
          fontSize: 13,
          lineHeight: 1.6,
          fontFamily: "var(--font-geist-mono), monospace",
        }}
        className={className}
        {...props}
      >
        {children}
      </code>
    );
  },
  pre: ({ ...props }) => <pre style={{ margin: "0 0 14px" }} {...props} />,
  table: ({ ...props }) => (
    <table
      style={{
        width: "100%",
        borderCollapse: "collapse",
        marginBottom: 14,
        background: "#fff",
        border: "1px solid #f2d3c5",
        borderRadius: 10,
        overflow: "hidden",
      }}
      {...props}
    />
  ),
  th: ({ ...props }) => (
    <th
      style={{
        border: "1px solid #f2d3c5",
        padding: "9px 10px",
        textAlign: "left",
        background: "#fff7f2",
        color: COLORS.TEXT_DARK,
        fontWeight: 500,
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
  td: ({ ...props }) => (
    <td
      style={{
        border: "1px solid #f2d3c5",
        padding: "9px 10px",
        textAlign: "left",
        color: "rgba(0,0,0,0.72)",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      }}
      {...props}
    />
  ),
};
