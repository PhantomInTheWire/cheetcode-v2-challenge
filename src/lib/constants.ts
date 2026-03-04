/**
 * Game constants shared across the application
 */

/** Site URL */
export const SITE_URL = "https://cheetcode-ctf.firecrawl.dev";

/** Round duration in milliseconds (60 seconds) */
export const ROUND_DURATION_MS = 60_000;

/** Round duration in seconds */
export const ROUND_DURATION_SECONDS = 60;

/** Number of problems per session */
export const PROBLEMS_PER_SESSION = 25;

/** Target for Level 2 */
export const LEVEL2_TOTAL = 10;

/** Target for Level 3 */
export const LEVEL3_TOTAL = 25;

/** Total solve target across all levels */
export const TOTAL_SOLVE_TARGET = PROBLEMS_PER_SESSION + LEVEL2_TOTAL + LEVEL3_TOTAL;

/** Game description text */
export const GAME_DESCRIPTION = `${PROBLEMS_PER_SESSION} problems. ${ROUND_DURATION_SECONDS} seconds. Good luck.`;
