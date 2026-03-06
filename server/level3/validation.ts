import { Sandbox } from "@vercel/sandbox";
import { createHash } from "node:crypto";
import { getLevel3ChallengeFromId } from "./problems";
import { buildLevel3SandboxRuntimeRunner } from "./sandboxRunner";
import { languageToExt, resolveLevel3TaskAssets } from "./taskAssets";
import { getKvClient, getKvJson, setKvJson } from "@/lib/abuse/kv";

export type Level3ValidationResult = {
  compiled: boolean;
  staleSession?: boolean;
  error: string;
  results: Array<{
    problemId: string;
    name?: string;
    correct: boolean;
    message: string;
  }>;
};

const CLIENT_COMPILE_ERROR = "Compilation failed. Fix build issues and retry.";
const CLIENT_INFRA_ERROR = "Validation infrastructure unavailable. Please retry shortly.";

export function sanitizeLevel3ValidationForClient(
  result: Level3ValidationResult,
): Level3ValidationResult {
  if (result.staleSession) return cloneResult(result);

  const loweredError = result.error.toLowerCase();
  const infraFailure =
    loweredError.includes("sandbox") ||
    loweredError.includes("infrastructure") ||
    loweredError.includes("tool install");

  return {
    compiled: result.compiled,
    staleSession: result.staleSession,
    error: result.compiled ? "" : infraFailure ? CLIENT_INFRA_ERROR : CLIENT_COMPILE_ERROR,
    results: result.results.map((row) => ({
      problemId: row.problemId,
      name: row.name,
      correct: row.correct,
      message: row.correct ? "pass" : "fail",
    })),
  };
}

function resolveSandboxCredentials():
  | { token: string; teamId: string; projectId: string }
  | undefined {
  const token = process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID;
  const projectId = process.env.VERCEL_PROJECT_ID;
  if (token && teamId && projectId) return { token, teamId, projectId };
  return undefined;
}

async function persistGeneratedSnapshotId(language: string, snapshotId: string): Promise<void> {
  snapshotIdByLanguage.set(language, snapshotId);
  await setKvJson(snapshotKvKey(language), { snapshotId }, SNAPSHOT_KV_TTL_SECONDS);
}

async function readStoredSnapshotId(language: string): Promise<string | undefined> {
  const inMemory = snapshotIdByLanguage.get(language);
  if (inMemory) return inMemory;

  const stored = await getKvJson<{ snapshotId?: string }>(snapshotKvKey(language));
  const snapshotId = stored?.snapshotId?.trim();
  if (snapshotId) {
    snapshotIdByLanguage.set(language, snapshotId);
    return snapshotId;
  }
  return undefined;
}

async function clearGeneratedSnapshotId(language: string, snapshotId?: string): Promise<void> {
  if (!snapshotId) return;
  if (snapshotIdByLanguage.get(language) === snapshotId) {
    snapshotIdByLanguage.delete(language);
  }

  const redis = getKvClient();
  if (!redis) return;
  const key = snapshotKvKey(language);
  const stored = await redis.get<{ snapshotId?: string }>(key);
  if (stored && typeof stored === "object" && stored.snapshotId === snapshotId) {
    await redis.del(key);
  }
}

const RUNTIME_TIMEOUT_MS = 300_000;
const USER_CODE_NETWORK_POLICY = "deny-all" as const;
const SNAPSHOT_EXPIRATION_MS = 14 * 24 * 60 * 60 * 1000;
const SNAPSHOT_KV_TTL_SECONDS = 13 * 24 * 60 * 60;
const snapshotIdByLanguage = new Map<string, string>();
const creatingSnapshotByLanguage = new Map<string, Promise<string>>();
const VALIDATION_CACHE_TTL_MS = 15 * 24 * 60 * 60 * 1000;
const VALIDATION_CACHE_TTL_SECONDS = Math.ceil(VALIDATION_CACHE_TTL_MS / 1000);
const FAILURE_CACHE_TTL_SECONDS = 15;
const validationCache = new Map<string, { expiresAt: number; result: Level3ValidationResult }>();

function snapshotKvKey(language: string): string {
  return `ctf:level3:sandbox-snapshot:v1:${language.toLowerCase()}`;
}

function validationAssetHash(taskId: string, language: string): string {
  const assets = resolveLevel3TaskAssets(taskId, language);
  const runnerSource = buildLevel3SandboxRuntimeRunner(taskId, language);
  const auxiliaryHashInput = assets.auxiliarySources
    .map((source) => `${source.filename}\n${source.content}`)
    .join("\n--aux-boundary--\n");
  return createHash("sha256")
    .update(assets.specTemplate, "utf8")
    .update("\n--spec-hash-boundary--\n", "utf8")
    .update(assets.harnessSource, "utf8")
    .update("\n--aux-hash-boundary--\n", "utf8")
    .update(auxiliaryHashInput, "utf8")
    .update("\n--runner-hash-boundary--\n", "utf8")
    .update(runnerSource, "utf8")
    .digest("hex");
}

function cacheKey(challengeId: string, taskId: string, language: string, code: string): string {
  const codeHash = createHash("sha256").update(code, "utf8").digest("hex");
  return `${challengeId}:${language}:${validationAssetHash(taskId, language)}:${codeHash}`;
}

function kvCacheKey(challengeId: string, taskId: string, language: string, code: string): string {
  return `ctf:level3:validation:v1:${cacheKey(challengeId, taskId, language, code)}`;
}

function cloneResult(result: Level3ValidationResult): Level3ValidationResult {
  return {
    compiled: result.compiled,
    staleSession: result.staleSession,
    error: result.error,
    results: result.results.map((r) => ({ ...r })),
  };
}

function logLevel3ValidationOutcome(
  challengeId: string,
  result: Level3ValidationResult,
  source: "fresh" | "memory_cache" | "kv_cache",
): void {
  const failed = result.results.filter((row) => !row.correct);
  if (result.compiled === false) {
    console.warn(
      `level3 validation failed challenge=${challengeId} source=${source} compiled=0 error=${JSON.stringify(result.error)}`,
    );
    return;
  }
  if (failed.length === 0) {
    console.info(
      `level3 validation passed challenge=${challengeId} source=${source} checks=${result.results.length}`,
    );
    return;
  }

  const failedSummary = failed
    .map((row) => {
      const checkKey = row.problemId.split(":").pop() ?? row.problemId;
      return `${checkKey}=${JSON.stringify(row.message)}`;
    })
    .join(", ");
  console.warn(
    `level3 validation partial challenge=${challengeId} source=${source} failed=${failed.length}/${result.results.length} ${failedSummary}`,
  );
}

async function ensureToolchain(sandbox: Sandbox, language: string): Promise<string | null> {
  const required = language === "Rust" ? ["clang", "rustc", "cargo"] : ["clang"];

  const check = await sandbox.runCommand({
    cmd: "sh",
    args: [
      "-lc",
      `for t in ${required.join(" ")}; do command -v "$t" >/dev/null 2>&1 || echo "$t"; done`,
    ],
  });
  const missingRaw = ((await check.stdout()) || "").trim();
  const missing = missingRaw ? missingRaw.split(/\s+/).filter(Boolean) : [];
  if (missing.length === 0) return null;

  const args = ["install", "-y", ...new Set(missing)];
  const install = await sandbox.runCommand({ cmd: "dnf", args, sudo: true });
  if (install.exitCode !== 0) {
    return (
      ((await install.stderr()) || (await install.stdout()) || "dnf install failed") +
      ` (missing: ${missing.join(", ")})`
    ).slice(0, 3000);
  }
  return null;
}

async function createSandboxForLanguage(language: string): Promise<Sandbox & AsyncDisposable> {
  const credentials = resolveSandboxCredentials();
  let snapshotId = await ensureSnapshotId(language);

  for (let attempt = 0; attempt < 2; attempt++) {
    if (!snapshotId) throw new Error(`no sandbox snapshot available for ${language}`);
    try {
      const sandbox = await Sandbox.create({
        source: {
          type: "snapshot",
          snapshotId,
        },
        timeout: RUNTIME_TIMEOUT_MS,
        networkPolicy: USER_CODE_NETWORK_POLICY,
        ...(credentials ?? {}),
      });
      snapshotIdByLanguage.set(language, snapshotId);
      return sandbox;
    } catch (error) {
      if (attempt === 1) throw error;
      await clearGeneratedSnapshotId(language, snapshotId);
      snapshotId = await ensureSnapshotId(language, { forceRefresh: true });
    }
  }

  throw new Error(`no sandbox snapshot available for ${language}`);
}

async function ensureSnapshotId(
  language: string,
  options?: { forceRefresh?: boolean },
): Promise<string | undefined> {
  const existing = options?.forceRefresh ? undefined : await readStoredSnapshotId(language);
  if (existing) {
    snapshotIdByLanguage.set(language, existing);
    return existing;
  }

  const pending = creatingSnapshotByLanguage.get(language);
  if (pending) return pending;

  const createPromise = (async () => {
    const credentials = resolveSandboxCredentials();
    const sandbox = await Sandbox.create({
      runtime: "node24",
      timeout: RUNTIME_TIMEOUT_MS,
      ...(credentials ?? {}),
    });
    try {
      const setupError = await ensureToolchain(sandbox, language);
      if (setupError) {
        throw new Error(`sandbox tool install failed: ${setupError}`);
      }
      const snapshot = await sandbox.snapshot({ expiration: SNAPSHOT_EXPIRATION_MS });
      await persistGeneratedSnapshotId(language, snapshot.snapshotId);
      console.info(`level3 bootstrap snapshot for ${language}: ${snapshot.snapshotId}`);
      return snapshot.snapshotId;
    } catch (error) {
      await sandbox.stop({ blocking: true }).catch(() => undefined);
      throw error;
    }
  })();

  creatingSnapshotByLanguage.set(language, createPromise);
  try {
    return await createPromise;
  } finally {
    creatingSnapshotByLanguage.delete(language);
  }
}

async function ensureRuntimePrepared(
  sandbox: Sandbox,
  taskId: string,
  language: string,
): Promise<void> {
  try {
    await sandbox.updateNetworkPolicy(USER_CODE_NETWORK_POLICY);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to enforce sandbox network policy: ${message}`);
  }
  const assets = resolveLevel3TaskAssets(taskId, language);
  await sandbox.writeFiles([
    { path: "harness.c", content: Buffer.from(assets.harnessSource, "utf8") },
    ...assets.auxiliarySources.map((source) => ({
      path: source.filename,
      content: Buffer.from(source.content, "utf8"),
    })),
    {
      path: "runner.mjs",
      content: Buffer.from(buildLevel3SandboxRuntimeRunner(taskId, language), "utf8"),
    },
  ]);
}

async function runInSandbox<T>(
  taskId: string,
  language: string,
  fn: (sandbox: Sandbox) => Promise<T>,
) {
  const sandbox = await createSandboxForLanguage(language);
  try {
    await sandbox.extendTimeout(120_000).catch(() => undefined);
    await ensureRuntimePrepared(sandbox, taskId, language);
    return await fn(sandbox);
  } finally {
    await sandbox.stop({ blocking: true }).catch(() => undefined);
  }
}

export async function validateLevel3Submission(
  challengeId: string,
  code: string,
): Promise<Level3ValidationResult> {
  const challenge = getLevel3ChallengeFromId(challengeId);
  if (!challenge) {
    const result = {
      compiled: false,
      staleSession: true,
      error:
        "Unknown Level 3 challenge ID. This session was created with an older task config. Start a new Level 3 session.",
      results: [],
    };
    logLevel3ValidationOutcome(challengeId, result, "fresh");
    return result;
  }

  const key = cacheKey(challengeId, challenge.taskId, challenge.language, code);
  const sharedKey = kvCacheKey(challengeId, challenge.taskId, challenge.language, code);
  const cached = validationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.info(`level3 validate cache hit for ${challengeId}`);
    const result = cloneResult(cached.result);
    logLevel3ValidationOutcome(challengeId, result, "memory_cache");
    return result;
  } else if (cached) {
    validationCache.delete(key);
  }

  const kvCached = await getKvJson<Level3ValidationResult>(sharedKey);
  if (kvCached) {
    console.info(`level3 validate KV cache hit for ${challengeId}`);
    validationCache.set(key, {
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
      result: cloneResult(kvCached),
    });
    const result = cloneResult(kvCached);
    logLevel3ValidationOutcome(challengeId, result, "kv_cache");
    return result;
  }

  const t0 = Date.now();
  let runDurationMs = 0;
  let createMs = 0;
  let writeMs = 0;
  let readMs = 0;
  try {
    const ext = languageToExt(challenge.language);
    const sandboxCreateStart = Date.now();
    const runtimeResult = await runInSandbox(
      challenge.taskId,
      challenge.language,
      async (sandbox) => {
        createMs = Date.now() - sandboxCreateStart;
        const writeStart = Date.now();
        await sandbox.writeFiles([{ path: `main.${ext}`, content: Buffer.from(code, "utf8") }]);
        writeMs = Date.now() - writeStart;

        const runStart = Date.now();
        const run = await sandbox.runCommand({
          cmd: "node",
          args: ["runner.mjs"],
        });
        runDurationMs = Date.now() - runStart;
        if (run.exitCode !== 0) {
          const stderr = (
            (await run.stderr()) ||
            (await run.stdout()) ||
            "node runner failed"
          ).slice(0, 3000);
          return {
            type: "run_error" as const,
            stderr,
          };
        }

        const readStart = Date.now();
        const resultBuffer = await sandbox.readFileToBuffer({ path: "result.json" });
        readMs = Date.now() - readStart;
        if (!resultBuffer) {
          return { type: "missing_result" as const };
        }
        const parsed = JSON.parse(resultBuffer.toString("utf8")) as {
          compiled: boolean;
          error: string;
          harness: Record<string, { ok: boolean; message: string }>;
        };
        return { type: "ok" as const, parsed };
      },
    );

    if (runtimeResult.type === "run_error") {
      const result = {
        compiled: false,
        error: `sandbox runner failed: ${runtimeResult.stderr}`,
        results: challenge.checks.map((check) => ({
          problemId: check.id,
          name: check.name,
          correct: false,
          message: "sandbox runner failed",
        })),
      };
      logLevel3ValidationOutcome(challengeId, result, "fresh");
      return result;
    }
    if (runtimeResult.type === "missing_result") {
      const result = {
        compiled: false,
        error: "sandbox runner did not produce result.json",
        results: challenge.checks.map((check) => ({
          problemId: check.id,
          name: check.name,
          correct: false,
          message: "no result artifact",
        })),
      };
      logLevel3ValidationOutcome(challengeId, result, "fresh");
      return result;
    }

    const parsed = runtimeResult.parsed;

    const results = challenge.checks.map((check) => {
      const key = check.id.split(":").pop() ?? "";
      const outcome = parsed.harness?.[key];
      return {
        problemId: check.id,
        name: check.name,
        correct: Boolean(outcome?.ok),
        message:
          outcome?.message ?? (parsed.compiled ? "missing harness output" : "compile failed"),
      };
    });

    const finalResult: Level3ValidationResult = {
      compiled: parsed.compiled,
      error: parsed.error || "",
      results,
    };
    validationCache.set(key, {
      expiresAt: Date.now() + VALIDATION_CACHE_TTL_MS,
      result: cloneResult(finalResult),
    });
    await setKvJson(sharedKey, finalResult, VALIDATION_CACHE_TTL_SECONDS);
    logLevel3ValidationOutcome(challengeId, finalResult, "fresh");
    return finalResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failureResult: Level3ValidationResult = {
      compiled: false,
      error:
        "Failed to create/use Vercel Sandbox. Ensure Vercel auth is configured (VERCEL_OIDC_TOKEN or VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID). " +
        message,
      results: challenge.checks.map((check) => ({
        problemId: check.id,
        name: check.name,
        correct: false,
        message: "sandbox unavailable",
      })),
    };
    validationCache.set(key, {
      expiresAt: Date.now() + Math.min(15_000, VALIDATION_CACHE_TTL_MS),
      result: cloneResult(failureResult),
    });
    await setKvJson(sharedKey, failureResult, FAILURE_CACHE_TTL_SECONDS);
    logLevel3ValidationOutcome(challengeId, failureResult, "fresh");
    return failureResult;
  } finally {
    const totalMs = Date.now() - t0;
    console.info(
      `level3 validate task=${challenge.taskId} lang=${challenge.language} total=${totalMs}ms create=${createMs}ms write=${writeMs}ms run=${runDurationMs}ms read=${readMs}ms`,
    );
  }
}
