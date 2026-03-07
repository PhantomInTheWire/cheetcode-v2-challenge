"use client";

import Image from "next/image";

type IdentityPillProps = {
  github: string;
  image?: string | null;
  name?: string | null;
  showHandle?: boolean;
  marginTop?: number;
};

export function IdentityPill({
  github,
  image = null,
  name = null,
  showHandle = false,
  marginTop,
}: IdentityPillProps) {
  const displayName = name?.trim() || github;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        padding: "4px 12px 4px 4px",
        background: "rgba(0,0,0,0.04)",
        borderRadius: 999,
        marginTop,
      }}
    >
      {image ? (
        <Image
          src={image}
          alt=""
          width={22}
          height={22}
          style={{ borderRadius: "50%", border: "1px solid rgba(0,0,0,0.06)" }}
        />
      ) : (
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
            flexShrink: 0,
          }}
        >
          {github[0]?.toUpperCase()}
        </div>
      )}
      {showHandle ? (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            gap: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: 14,
              fontWeight: 500,
              color: "#262626",
              lineHeight: "18px",
              fontFamily: "var(--font-geist-sans), system-ui, -apple-system, sans-serif",
            }}
          >
            {displayName}
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 450,
              color: "rgba(0,0,0,0.45)",
              lineHeight: "16px",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            @{github}
          </span>
        </div>
      ) : (
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
      )}
    </div>
  );
}
