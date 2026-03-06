"use client";

import { useMemo, useState } from "react";

type LeaderboardRow = {
  github: string;
  solved: number;
  elo: number;
  attempts?: number;
};

type LeaderboardTableProps = {
  rows: LeaderboardRow[];
  totalSolveTarget: number;
  displayedSolveTarget: number;
  pageSize?: number;
};

export function LeaderboardTable({
  rows,
  totalSolveTarget,
  displayedSolveTarget,
  pageSize = 25,
}: LeaderboardTableProps) {
  const [page, setPage] = useState(0);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(rows.length / pageSize)),
    [rows, pageSize],
  );
  const currentPage = Math.min(page, totalPages - 1);
  const visibleRows = useMemo(
    () => rows.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
    [rows, currentPage, pageSize],
  );

  const headerStyle: React.CSSProperties = {
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 500,
    color: "rgba(0,0,0,0.35)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontFamily: "var(--font-geist-mono), monospace",
  };

  const cellStyle: React.CSSProperties = {
    padding: "10px 14px",
    fontSize: 13,
    color: "#262626",
    fontFamily: "var(--font-geist-mono), monospace",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div style={{ width: "100%", maxWidth: 520 }}>
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e8e8e8",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04), 0 0 0 0.5px rgba(0,0,0,0.02)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e8e8e8", background: "rgba(0,0,0,0.01)" }}>
              {["#", "Player", "Solved", "Tries", "Score"].map((h) => (
                <th key={h} style={headerStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  style={{
                    padding: "32px 14px",
                    textAlign: "center",
                    fontSize: 13,
                    color: "rgba(0,0,0,0.3)",
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                  }}
                >
                  No entries yet.
                </td>
              </tr>
            )}
            {visibleRows.map((row, i) => {
              const rank = currentPage * pageSize + i + 1;
              const isTop3 = rank <= 3;
              return (
                <tr
                  key={row.github}
                  style={{
                    borderBottom: "1px solid #f0f0f0",
                    transition: "background 0.2s",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.background = "rgba(250,93,25,0.02)")}
                  onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <td
                    style={{
                      ...cellStyle,
                      color: isTop3 ? "#fa5d19" : "rgba(0,0,0,0.25)",
                      fontWeight: 500,
                    }}
                  >
                    {String(rank).padStart(2, "0")}
                  </td>
                  <td style={{ ...cellStyle, color: "#262626", fontWeight: 450 }}>@{row.github}</td>
                  <td
                    style={{
                      ...cellStyle,
                      color: row.solved >= totalSolveTarget ? "#1a9338" : "rgba(0,0,0,0.35)",
                    }}
                  >
                    {row.solved}/{displayedSolveTarget}
                  </td>
                  <td style={{ ...cellStyle, color: "rgba(0,0,0,0.3)" }}>{row.attempts ?? 1}</td>
                  <td
                    style={{
                      ...cellStyle,
                      color: isTop3 ? "#fa5d19" : "#262626",
                      fontWeight: 500,
                    }}
                  >
                    {row.elo.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 12,
            marginTop: 16,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="btn-ghost"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 450,
            }}
          >
            Prev
          </button>
          <span
            style={{
              fontSize: 11,
              color: "rgba(0,0,0,0.3)",
              fontFamily: "var(--font-geist-mono), monospace",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            [ {currentPage + 1} / {totalPages} ]
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            className="btn-ghost"
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 450,
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
