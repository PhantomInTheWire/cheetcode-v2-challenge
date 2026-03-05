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
            <tr style={{ borderBottom: "1px solid #e8e8e8" }}>
              {["#", "Player", "Solved", "Tries", "Score"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "rgba(0,0,0,0.35)",
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                    fontFamily: "var(--font-geist-mono), monospace",
                  }}
                >
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
                    padding: "20px 14px",
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
                <tr key={row.github} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: isTop3 ? "#fa5d19" : "rgba(0,0,0,0.25)",
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {rank}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "#262626",
                      fontWeight: 450,
                      fontFamily: "var(--font-geist-mono), monospace",
                    }}
                  >
                    @{row.github}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 450,
                      color: row.solved >= totalSolveTarget ? "#1a9338" : "rgba(0,0,0,0.35)",
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.solved}/{displayedSolveTarget}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      color: "rgba(0,0,0,0.3)",
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {row.attempts ?? 1}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 500,
                      color: isTop3 ? "#fa5d19" : "rgba(0,0,0,0.35)",
                      fontFamily: "var(--font-geist-mono), monospace",
                      fontVariantNumeric: "tabular-nums",
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
            marginTop: 12,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              fontSize: 13,
              fontWeight: 450,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              background: currentPage === 0 ? "transparent" : "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: currentPage === 0 ? "not-allowed" : "pointer",
              color: currentPage === 0 ? "rgba(0,0,0,0.15)" : "#262626",
              transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            Prev
          </button>
          <span
            style={{
              fontSize: 12,
              color: "rgba(0,0,0,0.3)",
              fontFamily: "var(--font-geist-mono), monospace",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            style={{
              fontSize: 13,
              fontWeight: 450,
              fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
              background: currentPage >= totalPages - 1 ? "transparent" : "rgba(0,0,0,0.04)",
              border: "none",
              borderRadius: 8,
              padding: "6px 14px",
              cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer",
              color: currentPage >= totalPages - 1 ? "rgba(0,0,0,0.15)" : "#262626",
              transition: "all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1)",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
