# CheetCode v2 Approach

## What I'm trying to measure

CheetCode v1 is a solid, but it over-rewards speed and "one-shot correctness".

What I want v2 to measure is: how candidates run agents under constraints, do they understand the tools they use(agents, tools etc) and can they close the loop when it comes to agents so that they can move fast.

Concretely:

- Planning and decomposition.
- Coordination (do they parallelize without stepping on their own CPU/IO).
- Can they unblock their own agents through harness engineering
- Verification discipline (do they actually check things).
- Prompt Injections (do they get wrecked by edge cases, injections, or traps).

## Design goals

1. A solid platform that can truly measure AI orchestration skills.
2. Anti-gaming by default: problem variants + fingerprinting etc; shadow banning bad actors
3. Operator visibility: structured telemetry so reviews aren't guesswork.

## Architecture

The main changes are around validation, scoring semantics, and abuse resistance.(and ofcourse adding new levels)


Stage 1. Algorithmic puzzles

25 problems instead of 10: 20 easy/medium/hard, plus 5 ICPC-style with strict 60-second limits. The goal is to force deliberate orchestration decisions. Candidates or their orchestrator agent must classify problems by difficulty, decide which can be batched into subagents.

Ideal solutuon: A main orchestrator, batching the 20 easier problems across 4 subagents, each with 5 problems and a dedicated subagent for each of ICPC problems. These harder problems require iterative reasoning, even strong models take 30-40 seconds for each problem. Without proper orchestration, candidates time out. 

Stage 2. Large OSS search

10 questions requiring extraction from Chromium codebases, 60 seconds total. This exposes search bottlenecks. Broad grep over tens of millions of lines is slow; naive subagent spawning with each calling grep saturates CPU. Even two aggressive subagents can cripple a MacBook M3 Air. To succeed, candidates must scope searches and optimize subagent count and instruct their agents on doing search properly, or pivot to using indexed services like source.chromium.org or grep.app via firecrawl(they might need to write a custom skill to make this work reliably or some sub agents will always waste a lot of time making bad web fetch requests and curls to these sites). My main concern: this may require candidates to shallow clone large repositories.

Stage 3. Spec-driven systems task

Formal specification for a small systems component, implemented in pure C, C++, Rust, or Swift with no deps and single flat file (possibly compiled to WASM), ~2 minutes total time. Evaluation is test and benchmark based. This measures verification ability and tradeoff reasoning in systems programming, areas where agents struggle without proper harness. They tend to produce superficially correct but suboptimal or fragile fallbacks. This stage surfaces those weaknesses.

Bonus layer

Prompt injections, hidden flags, and failure traps embedded across stages that affect total score, evaluating resilience to adversarial inputs and prompt injections.


End-to-end flow:

1. User starts/restores a session.
2. Client posts candidate output to the level validate route.
3. Backend runs visible + hidden checks and returns structured feedback.
4. Client calls finish route when the level is done.
5. Backend persists attempt details and updates solved/leaderboard state.

Reliability choices (these matter operationally):

- Deterministic validation where possible.
- User-code failures (compile/runtime) are "normal" responses with feedback, not infra-looking 5xx.
- Infra failures are treated as infra failures. Don't blur the line.

## Telemetry (how it works, briefly)

This is the "process evidence" layer. It's not fancy, but it gives reviewers something real to look at besides pass/fail.

- Where events are recorded: `src/lib/attempt-telemetry.ts` sends events to Convex via `api.attemptTelemetry.recordEvent`.
- Auth model: telemetry writes require `CONVEX_MUTATION_SECRET` (the action rejects writes without it).
- What an event contains: `sessionId`, `github`, `level`, `eventType` (usually `validate_*` / `finish_*`), `route`, `status`, optional counts (`passCount`/`failCount`/`solvedCount`), and a small `summaryJson`.
- Artifacts: optional `artifactJson` is size-capped/truncated client-side, hashed (`sha256`), and stored once in `attemptArtifacts` (dedup by hash). The event stores `artifactId` + `artifactHash` so we can tie retries together and detect duplicates.
- Rollups: every write updates `sessionTelemetryRollups` (total events, validate vs finish counts, pass deltas, duplicate rate, improvement rate, etc). This is what powers "needs review" and "suspicious" flags.
- Queries for review: `convex/attemptTelemetry.ts` exposes session timelines (events + parsed summaries + linked artifacts) and rollups so you can audit an attempt end-to-end without digging through logs.

## Anti-gaming (how this is supposed to hold up)

The goal is not "perfectly game-proof". The goal is to make brittle strategies unreliable and expensive.

- Variants: multiple versions of the same task, rotated/picked per attempt.
- Hidden checks: edge tests, adversarial inputs, property-style checks where it fits.
- Process-aware scoring: trajectory matters, not just the final green check.
- Reviewer auditability: raw artifacts and derived metrics both exist, so review is not guesswork.
- Identity/abuse controls: `src/lib/abuse/*` (rate limiting, replay resistance, etc).
- Strict error semantics: user mistake != outage.

## Scoring (what I'm optimizing for)

Final quality is a blend of outcome + process evidence:

- Correctness: visible + hidden pass rate.
- Robustness: edge/adversarial behavior.
- Orchestration: iteration quality, recovery loops, verification behavior.
- Efficiency: time/attempt efficiency, with anti-shortcut guards.

This is intentionally not a "fastest wins" benchmark. A fast but fragile run should not win.

## What changed vs v1

Kept:

- Next.js app + Convex backend.
- Multi-level challenge concept.
- Local dev workflow.

Changed:

- Validation/finish semantics tightened so user errors get feedback.
- Stronger anti-gaming via variants + hidden checks.
- Scoring shifted toward orchestration evidence, not raw speed.
- Data model intent improved for review/leaderboard integrity.

## Tradeoffs / concerns (these are real)

1. Complexity goes up. Better signal costs more engineering and more maintenance.
2. Compute/runtime goes up. Hidden checks and robustness tests aren't free.
3. Calibration is annoying. Weights/thresholds need tuning on real candidate distributions.
4. Residual gaming risk always exists. Variants need rotation. Detectors need updates.

## Deployment notes

You can deploy this with your own infra/credentials:

- Configure `.env.local` (see `.env.example` if present).
- Provision Convex + auth secrets.
- Deploy frontend (Vercel) and verify the API routes end-to-end.
- Don't reuse upstream secrets.

## Submission links

- Fork URL: `<your-public-fork-url>`
- Deployed URL: `<your-live-deployment-url>`
