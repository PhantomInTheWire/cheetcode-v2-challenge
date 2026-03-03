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

10 questions requiring extraction from Chromium codebases, 60 seconds total. This exposes search bottlenecks. Broad grep over tens of millions of lines is slow; naive subagent spawning with each calling grep saturates CPU. Even two aggressive subagents can cripple a MacBook M3 Air.

Ideal solution: candidates must scope searches and optimize subagent count and instruct their agents on doing search properly(as in well scoped inside folders to reduce time else a broad search can easily take 10+secs to resolve)

Alternate solution: Use indexed services like source.chromium.org or grep.app via firecrawl(they might need to write a custom skill to make this work reliably or some sub agents will always waste a lot of time making bad web fetch requests and curls to these sites). This also allows them to skip cloning chromium locally

Stage 3. Spec-driven systems task

Formal specification for a small systems component, implemented in pure C, C++, Rust with no deps and single flat file, runs in a vercel firecracker sandbox. ~2 minutes total time. Evaluation is test and benchmark based. This measures verification ability+closing a self reviwing loop("harness engineering") and tradeoff reasoning in systems programming, areas where agents struggle without proper harness. They tend to produce superficially correct but suboptimal or fragile fallbacks. This stage surfaces those weaknesses.

Ideal solution: Have the agent write "blackbox" tests for the spec, then have another agent write code that passes these blackbox tests

Bonus layer

Prompt injections, hidden flags, and failure traps embedded across stages that affect total score, evaluating resilience to adversarial inputs and prompt injections.

## Telemetry

- Where events are recorded: `src/lib/attempt-telemetry.ts` sends events to Convex via `api.attemptTelemetry.recordEvent`.
- What an event contains: `sessionId`, `github`, `level`, `eventType` (usually `validate_*` / `finish_*`), `route`, `status`, optional counts (`passCount`/`failCount`/`solvedCount`), and a small `summaryJson`.
- Artifacts: optional `artifactJson` is size-capped/truncated client-side, hashed (`sha256`), and stored once in `attemptArtifacts` (dedup by hash). The event stores `artifactId` + `artifactHash` so we can tie retries together and detect duplicates.
- Rollups: every write updates `sessionTelemetryRollups` (total events, validate vs finish counts, pass deltas, duplicate rate, improvement rate, etc). This is what powers "needs review" and "suspicious" flags.
- Queries for review: `convex/attemptTelemetry.ts` exposes session timelines (events + parsed summaries + linked artifacts) and rollups so you can audit an attempt end-to-end without digging through logs.

## Anti-gaming

The goal is not "perfectly game-proof". The goal is to make brittle strategies unreliable and expensive and just deter abuse in general.

1.  Add basic IP + FingerprintJS–based shadow bans and rate limiting. Fingerprintjs generates a stable client/browser fingerprint and attaches it to API requests.
2.  Multiple questions and multiple variations of the same question. If I only intend to have 5 easy problems out of 25, the problem set should contain at least 20 easy problems that are randomly picked each time. It should not stop there. There should also be 5 variations with different IDs and descriptions but the same or similar solution.

For example, the Two Sum problem could be:

    a.  Given an array of integers nums of size n and an integer target, return the indices of two distinct elements such that nums[i] + nums[j] = target.
    b.  Given an array nums and a target T, return the two numbers that sum to T. If multiple answers exist, return any.

I have point 2 implemented for Level 1 with around 90 questions, and some questions have variations. It took a significant amount of time and consumed most of my Codex and Opus weekly quotas as such I did not optimize for this in Level 2 and Level 3, we can get more level 3 problems by running codex or opus overnight, with good instructions.

Ideally, I would have preferred dynamically picking random Codeforces and LeetCode questions for Level 1, but that violates the terms of service of those platforms. Some, like Codeforces, allow it for personal use, but for a hiring challenge this would be a violation.

## What changed vs v1

Kept:

- Next.js app + Convex backend.
- Multi-level challenge concept.
- Local dev workflow.
- Level 1 is still spiritually similar

Changed:

- New levels 2 and 3
- level 1 has more problems(10vs25), a new ('competitive')category of problems from ICPC contests archive(licensed under CC0 1.0 Universal)
- Stronger anti-gaming via variants + hidden checks/fingerprinting.
- Telementary

## Tradeoffs / concerns

1. Complexity. Better signal costs more engineering and more maintenance.
2. It will take a lot of tokens and human oversight to come up with more questions for level 2 and 3
3. added KV-store and sandbox to the infra, vercel bill will be higher.
4. The anti cheat/anti abuse is not full proof, but it is "good enough" in the sense that most bad actors will be rate-limited then shadow banned.
5. This kind of tracking with fingerprintjs and IP to a certain extent also allows us to indentify cheaters across their multiple github accounts
