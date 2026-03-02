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
          border: "1px solid #e5e5e5",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #e5e5e5" }}>
              {["#", "Player", "Solved", "Tries", "Score"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "12px 14px",
                    textAlign: "left",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "rgba(0,0,0,0.4)",
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
                  style={{ padding: "16px 14px", fontSize: 13, color: "rgba(0,0,0,0.4)" }}
                >
                  No entries yet.
                </td>
              </tr>
            )}
            {visibleRows.map((row, i) => {
              const rank = currentPage * pageSize + i + 1;
              return (
                <tr key={row.github} style={{ borderBottom: "1px solid #f0f0f0" }}>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 700,
                      color: rank <= 3 ? "#fa5d19" : "rgba(0,0,0,0.3)",
                    }}
                  >
                    {rank}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "#262626" }}>
                    @{row.github}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      color: row.solved >= totalSolveTarget ? "#1a9338" : "rgba(0,0,0,0.4)",
                    }}
                  >
                    {row.solved}/{displayedSolveTarget}
                  </td>
                  <td style={{ padding: "10px 14px", fontSize: 13, color: "rgba(0,0,0,0.35)" }}>
                    {row.attempts ?? 1}
                  </td>
                  <td
                    style={{
                      padding: "10px 14px",
                      fontSize: 13,
                      fontWeight: 600,
                      color: row.elo > 1000 ? "#fa5d19" : "rgba(0,0,0,0.4)",
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
            gap: 16,
            marginTop: 12,
          }}
        >
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "none",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              padding: "6px 14px",
              cursor: currentPage === 0 ? "not-allowed" : "pointer",
              color: currentPage === 0 ? "rgba(0,0,0,0.2)" : "#262626",
            }}
          >
            Prev
          </button>
          <span style={{ fontSize: 12, color: "rgba(0,0,0,0.4)" }}>
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={currentPage >= totalPages - 1}
            style={{
              fontSize: 12,
              fontWeight: 600,
              fontFamily: "inherit",
              background: "none",
              border: "1px solid #e5e5e5",
              borderRadius: 6,
              padding: "6px 14px",
              cursor: currentPage >= totalPages - 1 ? "not-allowed" : "pointer",
              color: currentPage >= totalPages - 1 ? "rgba(0,0,0,0.2)" : "#262626",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
