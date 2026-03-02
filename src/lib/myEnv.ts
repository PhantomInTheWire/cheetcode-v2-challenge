function normalize(value: string | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function getServerMyEnv(): string {
  return (
    normalize(process.env.MY_ENV) ||
    normalize(process.env.my_env) ||
    normalize(process.env.NEXT_PUBLIC_MY_ENV) ||
    normalize(process.env.NEXT_PUBLIC_my_env) ||
    "production"
  );
}

export function getClientMyEnv(): string {
  return (
    normalize(process.env.NEXT_PUBLIC_MY_ENV) ||
    normalize(process.env.NEXT_PUBLIC_my_env) ||
    "production"
  );
}

export function isServerDevMode(): boolean {
  return getServerMyEnv() === "development";
}

export function isClientDevMode(): boolean {
  return getClientMyEnv() === "development";
}

