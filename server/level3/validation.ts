import { Sandbox } from "@vercel/sandbox";
import { createHash } from "node:crypto";
import { getLevel3ChallengeFromId } from "./problems";
import { buildCpuNativeSandboxRunner } from "./sandboxRunner";

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

function extensionForLanguage(language: string): string {
  if (language === "C") return "c";
  if (language === "C++") return "cpp";
  if (language === "Rust") return "rs";
  throw new Error(`Unsupported Level 3 language: ${language}`);
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

const RUNTIME_TIMEOUT_MS = 300_000;
const RUNTIME_IDLE_SHUTDOWN_MS = 20_000;
const runtimeByLanguage = new Map<
  string,
  {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
  }
>();
const creatingRuntimeByLanguage = new Map<string, Promise<Sandbox & AsyncDisposable>>();
const VALIDATION_CACHE_TTL_MS = 90_000;
const validationCache = new Map<string, { expiresAt: number; result: Level3ValidationResult }>();

function cacheKey(challengeId: string, code: string): string {
  const hash = createHash("sha256").update(code, "utf8").digest("hex");
  return `${challengeId}:${hash}`;
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

  const sandbox = await Sandbox.create({
    runtime: "node24",
    timeout: RUNTIME_TIMEOUT_MS,
    ...(credentials ?? {}),
  });

  const setupError = await ensureToolchain(sandbox, language);
  if (setupError) {
    await sandbox.stop({ blocking: true }).catch(() => undefined);
    throw new Error(`sandbox tool install failed: ${setupError}`);
  }
  return sandbox;
}

function clearIdleTimer(runtime: { idleTimer: ReturnType<typeof setTimeout> | null }) {
  if (runtime.idleTimer) {
    clearTimeout(runtime.idleTimer);
    runtime.idleTimer = null;
  }
}

function scheduleIdleStop(
  language: string,
  runtime: {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
  },
) {
  clearIdleTimer(runtime);
  runtime.idleTimer = setTimeout(() => {
    void (async () => {
      const current = runtimeByLanguage.get(language);
      if (current !== runtime) return;
      await runtime.lock;
      if (runtimeByLanguage.get(language) !== runtime) return;
      runtimeByLanguage.delete(language);
      await runtime.sandbox.stop({ blocking: true }).catch(() => undefined);
      console.info(`level3 runtime ${language} stopped after ${RUNTIME_IDLE_SHUTDOWN_MS}ms idle`);
    })();
  }, RUNTIME_IDLE_SHUTDOWN_MS);
}

async function getOrCreateRuntime(language: string): Promise<{
  runtime: {
    sandbox: Sandbox & AsyncDisposable;
    lock: Promise<void>;
    idleTimer: ReturnType<typeof setTimeout> | null;
  };
  created: boolean;
}> {
  const existing = runtimeByLanguage.get(language);
  if (existing) {
    clearIdleTimer(existing);
    return { runtime: existing, created: false };
  }

  const pending = creatingRuntimeByLanguage.get(language);
  if (pending) {
    const sandbox = await pending;
    const runtime = runtimeByLanguage.get(language);
    if (runtime) {
      clearIdleTimer(runtime);
      return { runtime, created: false };
    }
    const createdRuntime = { sandbox, lock: Promise.resolve(), idleTimer: null };
    runtimeByLanguage.set(language, createdRuntime);
    return { runtime: createdRuntime, created: true };
  }

  const createPromise = createSandboxForLanguage(language);
  creatingRuntimeByLanguage.set(language, createPromise);
  try {
    const sandbox = await createPromise;
    const runtime = { sandbox, lock: Promise.resolve(), idleTimer: null };
    runtimeByLanguage.set(language, runtime);
    return { runtime, created: true };
  } finally {
    creatingRuntimeByLanguage.delete(language);
  }
}

async function recycleRuntime(language: string): Promise<void> {
  const runtime = runtimeByLanguage.get(language);
  if (!runtime) return;
  clearIdleTimer(runtime);
  runtimeByLanguage.delete(language);
  await runtime.sandbox.stop({ blocking: true }).catch(() => undefined);
}

async function runInRuntime<T>(
  language: string,
  fn: (sandbox: Sandbox) => Promise<T>,
): Promise<{ value: T; created: boolean }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { runtime, created } = await getOrCreateRuntime(language);

    const previousLock = runtime.lock;
    let release!: () => void;
    runtime.lock = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previousLock;
    try {
      await runtime.sandbox.extendTimeout(120_000).catch(() => undefined);
      const value = await fn(runtime.sandbox);
      return { value, created };
    } catch (error) {
      await recycleRuntime(language);
      if (attempt === 1) throw error;
    } finally {
      release();
      scheduleIdleStop(language, runtime);
    }
  }
  throw new Error("unreachable");
}

export async function warmLevel3Runtime(language: string): Promise<void> {
  try {
    const { runtime } = await getOrCreateRuntime(language);
    scheduleIdleStop(language, runtime);
  } catch (error) {
    console.warn(`level3 runtime warmup failed for ${language}:`, error);
  }
}

export async function validateLevel3Submission(
  challengeId: string,
  code: string,
): Promise<Level3ValidationResult> {
  const key = cacheKey(challengeId, code);
  const cached = validationCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    console.info(`level3 validate cache hit for ${challengeId}`);
    return cloneResult(cached.result);
  } else if (cached) {
    validationCache.delete(key);
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
    const ext = extensionForLanguage(challenge.language);
    const runtimeResult = await runInRuntime(challenge.language, async (sandbox) => {
      const writeStart = Date.now();
      await sandbox.writeFiles([
        { path: `main.${ext}`, content: Buffer.from(code, "utf8") },
        {
          path: "runner.mjs",
          content: Buffer.from(buildCpuNativeSandboxRunner(challenge.language), "utf8"),
        },
      ]);
      writeMs = Date.now() - writeStart;

      const runStart = Date.now();
      const run = await sandbox.runCommand({
        cmd: "node",
        args: ["runner.mjs"],
      });
      runDurationMs = Date.now() - runStart;
      if (run.exitCode !== 0) {
        const stderr = ((await run.stderr()) || (await run.stdout()) || "node runner failed").slice(
          0,
          3000,
        );
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
    });
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
    return failureResult;
  } finally {
    const totalMs = Date.now() - t0;
    console.info(
      `level3 validate ${challenge.language} total=${totalMs}ms created=${created ? 1 : 0} create=${createMs}ms write=${writeMs}ms run=${runDurationMs}ms read=${readMs}ms`,
    );
  }
}
