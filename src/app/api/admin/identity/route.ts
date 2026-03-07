import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "../../../../../convex/_generated/api";
import { adminForbiddenResponse, isAdminGithub } from "../../../../lib/admin-auth";
import {
  clearShadowBanForIdentityKey,
  isIdentityKeyShadowBanned,
  setShadowBanForIdentityKey,
} from "../../../../lib/abuse/guard";
import {
  clearKvShadowBan,
  getKvShadowBanStates,
  getKvClient,
  setKvShadowBan,
} from "../../../../lib/abuse/kv";
import { ENV } from "../../../../lib/env-vars";
import { requireAuthenticatedGithub } from "../../../../lib/request-auth";

type ConvexQueryCaller = (reference: unknown, args: Record<string, unknown>) => Promise<unknown>;

type IdentityLinkRow = {
  _id: string;
  sessionId: string;
  github: string;
  level: number;
  identityKey: string;
  identityKind: "ip" | "fp";
  route: string;
  screen?: string;
  firstSeenAt: number;
  lastSeenAt: number;
};

type AdminIdentityActionBody = {
  action?: "shadow_ban" | "unshadow_ban";
  identityKeys?: string[];
};

type AccountNode = {
  github: string;
  shadowBanned: boolean;
  lastSeenAt: number;
  levels: number[];
  sessionIds: string[];
  identityKeys: string[];
};

type IdentityNode = {
  identityKey: string;
  identityKind: "ip" | "fp";
  shadowBanned: boolean;
  accountCount: number;
  sessionCount: number;
  lastSeenAt: number;
  accounts: string[];
};

function isValidIdentityKey(identityKey: string): boolean {
  return /^(ip|fp):[a-f0-9]{16,}$/i.test(identityKey);
}

function sortByLastSeenDesc<T extends { lastSeenAt: number }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => b.lastSeenAt - a.lastSeenAt);
}

async function getShadowBanStateMap(identityKeys: string[]): Promise<Record<string, boolean>> {
  if (getKvClient()) {
    return await getKvShadowBanStates(identityKeys);
  }
  return Object.fromEntries(
    identityKeys.map((identityKey) => [identityKey, isIdentityKeyShadowBanned(identityKey)]),
  );
}

async function applyIdentityAction(
  action: "shadow_ban" | "unshadow_ban",
  identityKeys: string[],
): Promise<void> {
  if (getKvClient()) {
    if (action === "shadow_ban") {
      await Promise.all(identityKeys.map((identityKey) => setKvShadowBan(identityKey)));
    } else {
      await Promise.all(identityKeys.map((identityKey) => clearKvShadowBan(identityKey)));
    }
    return;
  }

  for (const identityKey of identityKeys) {
    if (action === "shadow_ban") {
      setShadowBanForIdentityKey(identityKey);
    } else {
      clearShadowBanForIdentityKey(identityKey);
    }
  }
}

function buildIdentityGraph(links: IdentityLinkRow[], shadowBanStates: Record<string, boolean>) {
  const accountMap = new Map<
    string,
    {
      github: string;
      lastSeenAt: number;
      levels: Set<number>;
      sessionIds: Set<string>;
      identityKeys: Set<string>;
    }
  >();
  const identityMap = new Map<
    string,
    {
      identityKey: string;
      identityKind: "ip" | "fp";
      lastSeenAt: number;
      accounts: Set<string>;
      sessionIds: Set<string>;
    }
  >();

  for (const link of links) {
    const account =
      accountMap.get(link.github) ??
      (() => {
        const next = {
          github: link.github,
          lastSeenAt: link.lastSeenAt,
          levels: new Set<number>(),
          sessionIds: new Set<string>(),
          identityKeys: new Set<string>(),
        };
        accountMap.set(link.github, next);
        return next;
      })();
    account.lastSeenAt = Math.max(account.lastSeenAt, link.lastSeenAt);
    account.levels.add(link.level);
    account.sessionIds.add(link.sessionId);
    account.identityKeys.add(link.identityKey);

    const identity =
      identityMap.get(link.identityKey) ??
      (() => {
        const next = {
          identityKey: link.identityKey,
          identityKind: link.identityKind,
          lastSeenAt: link.lastSeenAt,
          accounts: new Set<string>(),
          sessionIds: new Set<string>(),
        };
        identityMap.set(link.identityKey, next);
        return next;
      })();
    identity.lastSeenAt = Math.max(identity.lastSeenAt, link.lastSeenAt);
    identity.accounts.add(link.github);
    identity.sessionIds.add(link.sessionId);
  }

  const adjacency = new Map<string, Set<string>>();
  for (const github of accountMap.keys()) {
    adjacency.set(github, new Set<string>());
  }
  for (const identity of identityMap.values()) {
    const accounts = [...identity.accounts];
    for (const account of accounts) {
      const edges = adjacency.get(account) ?? new Set<string>();
      for (const peer of accounts) {
        if (peer !== account) edges.add(peer);
      }
      adjacency.set(account, edges);
    }
  }

  const visited = new Set<string>();
  const clusters: Array<{
    id: string;
    accountCount: number;
    lastSeenAt: number;
    shadowBanned: boolean;
    accounts: AccountNode[];
    identities: IdentityNode[];
  }> = [];

  for (const github of accountMap.keys()) {
    if (visited.has(github)) continue;
    const stack = [github];
    const componentAccounts = new Set<string>();
    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || visited.has(current)) continue;
      visited.add(current);
      componentAccounts.add(current);
      for (const next of adjacency.get(current) ?? []) {
        if (!visited.has(next)) stack.push(next);
      }
    }

    const accounts = sortByLastSeenDesc(
      [...componentAccounts].map((accountGithub) => {
        const account = accountMap.get(accountGithub)!;
        const identityKeys = [...account.identityKeys];
        return {
          github: account.github,
          shadowBanned: identityKeys.some((identityKey) => shadowBanStates[identityKey] === true),
          lastSeenAt: account.lastSeenAt,
          levels: [...account.levels].sort((a, b) => a - b),
          sessionIds: [...account.sessionIds],
          identityKeys,
        } satisfies AccountNode;
      }),
    );

    const componentIdentityKeys = new Set<string>();
    for (const account of accounts) {
      for (const identityKey of account.identityKeys) componentIdentityKeys.add(identityKey);
    }

    const identities = sortByLastSeenDesc(
      [...componentIdentityKeys].map((identityKey) => {
        const identity = identityMap.get(identityKey)!;
        return {
          identityKey,
          identityKind: identity.identityKind,
          shadowBanned: shadowBanStates[identityKey] === true,
          accountCount: identity.accounts.size,
          sessionCount: identity.sessionIds.size,
          lastSeenAt: identity.lastSeenAt,
          accounts: [...identity.accounts].sort(),
        } satisfies IdentityNode;
      }),
    ).sort((a, b) => {
      if (b.accountCount !== a.accountCount) return b.accountCount - a.accountCount;
      return b.lastSeenAt - a.lastSeenAt;
    });

    clusters.push({
      id: accounts
        .map((account) => account.github)
        .sort()
        .join("|"),
      accountCount: accounts.length,
      lastSeenAt: Math.max(...accounts.map((account) => account.lastSeenAt)),
      shadowBanned: identities.some((identity) => identity.shadowBanned),
      accounts,
      identities,
    });
  }

  return clusters.sort((a, b) => {
    if (b.accountCount !== a.accountCount) return b.accountCount - a.accountCount;
    return b.lastSeenAt - a.lastSeenAt;
  });
}

export async function GET(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  if (!isAdminGithub(authResult.github)) return adminForbiddenResponse();

  const url = new URL(request.url);
  const limit = Number(url.searchParams.get("limit") ?? "");
  const normalizedLimit = Number.isFinite(limit) ? limit : 1200;

  try {
    const convex = new ConvexHttpClient(ENV.NEXT_PUBLIC_CONVEX_URL);
    const callQuery = convex.query as unknown as ConvexQueryCaller;
    const links = (await callQuery(
      (api as typeof api & { sessionIdentity: { getRecentLinks: unknown } }).sessionIdentity
        .getRecentLinks,
      { limit: normalizedLimit },
    )) as IdentityLinkRow[];

    const shadowBanStates = await getShadowBanStateMap(links.map((link) => link.identityKey));
    const clusters = buildIdentityGraph(links, shadowBanStates);

    return NextResponse.json({
      capturedIdentityLinks: links.length,
      graphWindowLimited: links.length >= normalizedLimit,
      clusters,
    });
  } catch (error) {
    console.error("/api/admin/identity GET error:", error);
    return NextResponse.json({ error: "Failed to load identity graph" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authResult = await requireAuthenticatedGithub(request);
  if ("response" in authResult) return authResult.response;
  if (!isAdminGithub(authResult.github)) return adminForbiddenResponse();

  const body = (await request.json().catch(() => ({}))) as AdminIdentityActionBody;
  const action = body.action;
  const identityKeys = [...new Set((body.identityKeys ?? []).filter(isValidIdentityKey))];

  if (!action || identityKeys.length === 0) {
    return NextResponse.json(
      { error: "valid action and identityKeys are required" },
      { status: 400 },
    );
  }

  try {
    await applyIdentityAction(action, identityKeys);
    const shadowBanStates = await getShadowBanStateMap(identityKeys);
    return NextResponse.json({ ok: true, shadowBanStates });
  } catch (error) {
    console.error("/api/admin/identity POST error:", error);
    return NextResponse.json({ error: "Failed to update shadow ban state" }, { status: 500 });
  }
}
