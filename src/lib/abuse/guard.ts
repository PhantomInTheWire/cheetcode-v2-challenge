import {
  acquireKvLevel3InflightLock,
  releaseKvLevel3InflightLock,
  resetKvLevel3InflightLocksForTests,
} from "./kv";
import { TRUSTED_FINGERPRINT_HEADER } from "./identity";
import { getIdentityKeys } from "./identity";

export const SHADOW_BAN_HEADER = "x-ctf-shadow-banned";
export { TRUSTED_FINGERPRINT_HEADER };

const INFLIGHT_LEVEL3_TTL_MS = 30_000;
const localShadowBans = new Map<string, number>();

export type Level3InflightLock = {
  entries: Array<{
    scopeKey: string;
    token: string;
  }>;
};

export async function acquireLevel3InflightLock(
  request: Request,
  github: string,
): Promise<{ ok: true; lock: Level3InflightLock } | { ok: false; reason: "busy" | "unavailable" }> {
  const scopeKeys = [...new Set([`gh:${github.trim().toLowerCase()}`, ...getIdentityKeys(request)])];
  const acquired: Level3InflightLock["entries"] = [];

  for (const scopeKey of scopeKeys) {
    const result = await acquireKvLevel3InflightLock(scopeKey, INFLIGHT_LEVEL3_TTL_MS);
    if (result.ok === false) {
      await Promise.all(
        acquired.map(async (entry) => {
          await releaseKvLevel3InflightLock(entry.scopeKey, entry.token);
        }),
      );
      return { ok: false, reason: result.reason };
    }
    acquired.push({ scopeKey, token: result.token });
  }

  return { ok: true, lock: { entries: acquired } };
}

export async function releaseLevel3InflightLock(lock: Level3InflightLock): Promise<void> {
  await Promise.all(
    lock.entries.map(async (entry) => {
      await releaseKvLevel3InflightLock(entry.scopeKey, entry.token);
    }),
  );
}

export function isIdentityKeyShadowBanned(identityKey: string): boolean {
  const expiresAt = localShadowBans.get(identityKey) ?? 0;
  if (expiresAt <= Date.now()) {
    localShadowBans.delete(identityKey);
    return false;
  }
  return true;
}

export function setShadowBanForIdentityKey(
  identityKey: string,
  ttlMs: number = 24 * 60 * 60_000,
): void {
  localShadowBans.set(identityKey, Date.now() + Math.max(1_000, ttlMs));
}

export function clearShadowBanForIdentityKey(identityKey: string): void {
  localShadowBans.delete(identityKey);
}

export function resetLevel3InflightLocksForTests(): void {
  resetKvLevel3InflightLocksForTests();
  localShadowBans.clear();
}
