function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is not set.`);
  }
  return value;
}

function normalize(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

function getServerMyEnv(): string {
  return normalize(process.env.MY_ENV) || normalize(process.env.my_env) || "production";
}

function getClientMyEnv(): string {
  return (
    normalize(process.env.NEXT_PUBLIC_MY_ENV) ||
    normalize(process.env.NEXT_PUBLIC_my_env) ||
    "production"
  );
}

export const ENV = {
  get NEXT_PUBLIC_CONVEX_URL() {
    return getRequiredEnv("NEXT_PUBLIC_CONVEX_URL");
  },
  get CONVEX_MUTATION_SECRET() {
    return getRequiredEnv("CONVEX_MUTATION_SECRET");
  },
  get ADMIN_GITHUB_USERS() {
    return process.env.ADMIN_GITHUB_USERS ?? "";
  },
} as const;

export function isServerDevMode(): boolean {
  return getServerMyEnv() === "development";
}

export function isClientDevMode(): boolean {
  return getClientMyEnv() === "development";
}
