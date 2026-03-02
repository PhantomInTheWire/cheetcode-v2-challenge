/**
 * Centralized environment variable validation.
 * Prevents "process.env.VAR!" assertions that throw cryptic runtime errors.
 */

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set.`);
  }
  return value;
}

export const ENV = {
  get NEXT_PUBLIC_CONVEX_URL() {
    return getRequiredEnv("NEXT_PUBLIC_CONVEX_URL");
  },
  get CONVEX_MUTATION_SECRET() {
    return getRequiredEnv("CONVEX_MUTATION_SECRET");
  },
} as const;
