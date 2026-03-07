export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const ROUND_DURATION_MS = 60_000;
export const ROUND_DURATION_SECONDS = 60;
export const PROBLEMS_PER_SESSION = 25;
export const LEVEL2_TOTAL = 10;
export const LEVEL3_TOTAL = 25;
export const TOTAL_SOLVE_TARGET = PROBLEMS_PER_SESSION + LEVEL2_TOTAL + LEVEL3_TOTAL;
export const GAME_DESCRIPTION = `${PROBLEMS_PER_SESSION} problems. ${ROUND_DURATION_SECONDS} seconds. Good luck.`;
