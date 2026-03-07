/**
 * Centralized theme colors for CheetCode CTF.
 * Prevents hardcoded color smells and ensures brand consistency.
 */

export const COLORS = {
  // Brand colors
  PRIMARY: "#fa5d19", // Fire orange
  PRIMARY_LIGHT: "rgba(250, 93, 25, 0.15)",
  PRIMARY_HOVER: "#e54e10",

  // Feedback colors
  SUCCESS: "#1a9338",
  SUCCESS_LIGHT: "rgba(26, 147, 56, 0.1)",
  ERROR: "#dc2626",
  ERROR_LIGHT: "#fef2f2",
  WARNING: "#b45309",
  INFO: "#3b82f6",

  // Text colors
  TEXT_DARK: "#262626",
  TEXT_MUTED: "rgba(0,0,0,0.35)",
  TEXT_DIM: "rgba(0,0,0,0.25)",
  TEXT_WHITE: "#ffffff",

  // Backgrounds/Borders
  BG_PAGE: "#f9f9f9",
  BG_CARD: "#ffffff",
  BG_INPUT: "#fafafa",
  BG_MUTED: "#f3f3f3",
  BORDER_LIGHT: "#e8e8e8",
  BORDER_ACCENT: "#f0f0f0",
} as const;
