import { Sandbox } from "@vercel/sandbox";
import { createHash } from "node:crypto";
import { getLevel3ChallengeFromId } from "./problems";
import { buildLevel3SandboxRuntimeRunner } from "./sandboxRunner";
import { languageToExt, readLevel3TaskAsset } from "./taskAssets";
import { getKvJson, setKvJson } from "@/lib/abuse/kv";

export type Level3ValidationResult = {
  compiled: boolean;
  staleSession?: boolean;
  error: string;
  results: Array<{
    problemId: string;
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

function snapshotEnvKey(language: string): string {
  return language === "Rust" ? "VERCEL_SANDBOX_SNAPSHOT_RUST" : "VERCEL_SANDBOX_SNAPSHOT_CLANG";
}

function configuredSnapshotIdForLanguage(language: string): string | undefined {
  const snapshotId = process.env[snapshotEnvKey(language)]?.trim();
  return snapshotId ? snapshotId : undefined;
}

const RUNTIME_TIMEOUT_MS = 300_000;
const RUNTIME_IDLE_SHUTDOWN_MS = 300_000;
const USER_CODE_NETWORK_POLICY = "deny-all" as const;
const runtimeByKey = new Map<
  string,
  {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
    prepared: boolean;
  }
>();
const creatingRuntimeByKey = new Map<string, Promise<Sandbox & AsyncDisposable>>();
const snapshotIdByLanguage = new Map<string, string>();
const creatingSnapshotByLanguage = new Map<string, Promise<string>>();
const VALIDATION_CACHE_TTL_MS = 90_000;
const VALIDATION_CACHE_TTL_SECONDS = Math.ceil(VALIDATION_CACHE_TTL_MS / 1000);
const FAILURE_CACHE_TTL_SECONDS = 15;
const validationCache = new Map<string, { expiresAt: number; result: Level3ValidationResult }>();

function cacheKey(challengeId: string, code: string): string {
  const hash = createHash("sha256").update(code, "utf8").digest("hex");
  return `${challengeId}:${hash}`;
}

function kvCacheKey(challengeId: string, code: string): string {
  return `ctf:level3:validation:v1:${cacheKey(challengeId, code)}`;
}

function cloneResult(result: Level3ValidationResult): Level3ValidationResult {
  return {
    compiled: result.compiled,
    staleSession: result.staleSession,
    error: result.error,
    results: result.results.map((r) => ({ ...r })),
  };
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
  const snapshotId =
    (await ensureSnapshotId(language)) ??
    snapshotIdByLanguage.get(language) ??
    configuredSnapshotIdForLanguage(language);

  if (snapshotId) {
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
  }
  throw new Error(`no sandbox snapshot available for ${language}`);
}

async function ensureSnapshotId(language: string): Promise<string | undefined> {
  const existing = snapshotIdByLanguage.get(language) ?? configuredSnapshotIdForLanguage(language);
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
      const snapshot = await sandbox.snapshot();
      snapshotIdByLanguage.set(language, snapshot.snapshotId);
      console.info(`level3 bootstrap snapshot for ${language}: ${snapshot.snapshotId}`);
      return snapshot.snapshotId;
    } finally {
      await sandbox.stop({ blocking: true }).catch(() => undefined);
    }
  })();

  creatingSnapshotByLanguage.set(language, createPromise);
  try {
    return await createPromise;
  } finally {
    creatingSnapshotByLanguage.delete(language);
  }
}

function clearIdleTimer(runtime: { idleTimer: ReturnType<typeof setTimeout> | null }) {
  if (runtime.idleTimer) {
    clearTimeout(runtime.idleTimer);
    runtime.idleTimer = null;
  }
}

function scheduleIdleStop(
  runtimeKey: string,
  runtime: {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
  },
) {
  clearIdleTimer(runtime);
  runtime.idleTimer = setTimeout(() => {
    void (async () => {
      const current = runtimeByKey.get(runtimeKey);
      if (current !== runtime) return;
      await runtime.lock;
      if (runtimeByKey.get(runtimeKey) !== runtime) return;
      runtimeByKey.delete(runtimeKey);
      await runtime.sandbox.stop({ blocking: true }).catch(() => undefined);
      console.info(`level3 runtime ${runtimeKey} stopped after ${RUNTIME_IDLE_SHUTDOWN_MS}ms idle`);
    })();
  }, RUNTIME_IDLE_SHUTDOWN_MS);
}

async function getOrCreateRuntime(
  taskId: string,
  language: string,
): Promise<{
  runtime: {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
    prepared: boolean;
  };
  created: boolean;
}> {
  const runtimeKey = `${taskId}:${language}`;
  const existing = runtimeByKey.get(runtimeKey);
  if (existing) {
    clearIdleTimer(existing);
    return { runtime: existing, created: false };
  }

  const pending = creatingRuntimeByKey.get(runtimeKey);
  if (pending) {
    const sandbox = await pending;
    const runtime = runtimeByKey.get(runtimeKey);
    if (runtime) {
      clearIdleTimer(runtime);
      return { runtime, created: false };
    }
    const createdRuntime = { sandbox, lock: Promise.resolve(), idleTimer: null, prepared: false };
    runtimeByKey.set(runtimeKey, createdRuntime);
    return { runtime: createdRuntime, created: true };
  }

  const createPromise = createSandboxForLanguage(language);
  creatingRuntimeByKey.set(runtimeKey, createPromise);
  try {
    const sandbox = await createPromise;
    const runtime = { sandbox, lock: Promise.resolve(), idleTimer: null, prepared: false };
    runtimeByKey.set(runtimeKey, runtime);
    return { runtime, created: true };
  } finally {
    creatingRuntimeByKey.delete(runtimeKey);
  }
}

async function recycleRuntime(taskId: string, language: string): Promise<void> {
  const runtimeKey = `${taskId}:${language}`;
  const runtime = runtimeByKey.get(runtimeKey);
  if (!runtime) return;
  clearIdleTimer(runtime);
  runtimeByKey.delete(runtimeKey);
  await runtime.sandbox.stop({ blocking: true }).catch(() => undefined);
}

async function ensureRuntimePrepared(
  runtime: {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
    prepared: boolean;
  },
  taskId: string,
  language: string,
): Promise<void> {
  if (runtime.prepared) return;
  try {
    await runtime.sandbox.updateNetworkPolicy(USER_CODE_NETWORK_POLICY);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`failed to enforce sandbox network policy: ${message}`);
  }
  const harnessSource = readLevel3TaskAsset(taskId, "harness.c");
  await runtime.sandbox.writeFiles([
    { path: "harness.c", content: Buffer.from(harnessSource, "utf8") },
    {
      path: "runner.mjs",
      content: Buffer.from(buildLevel3SandboxRuntimeRunner(taskId, language), "utf8"),
    },
  ]);
  runtime.prepared = true;
}

async function runInRuntime<T>(
  taskId: string,
  language: string,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<{ value: T; created: boolean }> {
  const runtimeKey = `${taskId}:${language}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const { runtime, created } = await getOrCreateRuntime(taskId, language);

    const previousLock = runtime.lock;
    let release!: () => void;
    runtime.lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousLock;
    try {
      await runtime.sandbox.extendTimeout(120_000).catch(() => undefined);
      await ensureRuntimePrepared(runtime, taskId, language);
      const value = await fn(runtime.sandbox);
      return { value, created };
    } catch (error) {
      await recycleRuntime(taskId, language);
      if (attempt === 1) throw error;
    } finally {
      release();
      scheduleIdleStop(runtimeKey, runtime);
    }
  }
  throw new Error("unreachable");
}

export async function validateLevel3Submission(
  challengeId: string,
  code: string,
): Promise<Level3ValidationResult> {
  const key = cacheKey(challengeId, code);
  const sharedKey = kvCacheKey(challengeId, code);
  const cached = validationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.info(`level3 validate cache hit for ${challengeId}`);
    return cloneResult(cached.result);
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
    return cloneResult(kvCached);
  }

  const challenge = getLevel3ChallengeFromId(challengeId);
  if (!challenge) {
    return {
      compiled: false,
      staleSession: true,
      error:
        "Unknown Level 3 challenge ID. This session was created with an older task config. Start a new Level 3 session.",
      results: [],
    };
  }

  const t0 = Date.now();
  let created = false;
  let runDurationMs = 0;
  let createMs = 0;
  let writeMs = 0;
  let readMs = 0;
  try {
    const ext = languageToExt(challenge.language);
    const runtimeResult = await runInRuntime(
      challenge.taskId,
      challenge.language,
      async (sandbox) => {
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
    created = runtimeResult.created;
    createMs = created ? Date.now() - t0 - writeMs - runDurationMs - readMs : 0;

    if (runtimeResult.value.type === "run_error") {
      return {
        compiled: false,
        error: `sandbox runner failed: ${runtimeResult.value.stderr}`,
        results: challenge.checks.map((check) => ({
          problemId: check.id,
          correct: false,
          message: "sandbox runner failed",
        })),
      };
    }
    if (runtimeResult.value.type === "missing_result") {
      return {
        compiled: false,
        error: "sandbox runner did not produce result.json",
        results: challenge.checks.map((check) => ({
          problemId: check.id,
          correct: false,
          message: "no result artifact",
        })),
      };
    }

    const parsed = runtimeResult.value.parsed;

    const results = challenge.checks.map((check) => {
      const key = check.id.split(":").pop() ?? "";
      const outcome = parsed.harness?.[key];
      return {
        problemId: check.id,
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
        correct: false,
        message: "sandbox unavailable",
      })),
    };
    validationCache.set(key, {
      expiresAt: Date.now() + Math.min(15_000, VALIDATION_CACHE_TTL_MS),
      result: cloneResult(failureResult),
    });
    await setKvJson(sharedKey, failureResult, FAILURE_CACHE_TTL_SECONDS);
    return failureResult;
  } finally {
    const totalMs = Date.now() - t0;
    console.info(
      `level3 validate task=${challenge.taskId} lang=${challenge.language} total=${totalMs}ms created=${created ? 1 : 0} create=${createMs}ms write=${writeMs}ms run=${runDurationMs}ms read=${readMs}ms`,
    );
  }
}
