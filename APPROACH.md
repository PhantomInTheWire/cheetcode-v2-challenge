# CheetCode v2 Approach

## 1. Problem framing

CheetCode v1 was a cool test, but it over-indexed on speed and one-shot correctness.

I redesigned v2 to answer a different question: can candidates design, orchestrate, and ship stuff with agents under constraints?

Whilst making sure they knew what they were doing and understood tradeoffs to a certain degree.

tldr: the goal is to look for strong engineers who can use AI to ship real systems, understand architecture and tradeoffs. Also they should be able to figure out ways to unblock their agents and make them faster.

## 2. Design goals

1. The platform should test [Harness Engineering](https://openai.com/index/harness-engineering/), while also indexing on mature engineering discipline and agent orchestration ability
2. A good UI/UX because firecrawl.dev is one of the better looking websites in the space, if deployed as the final challenge this should not change that
3. A great dashboard to do product analytics and track abuse, cheating and other candidate patterns.
4. Strong fingerprinting, anti-cheat and abuse mechanisms.
5. The total time for a single attempt should be < 5mins, this is because anything that takes more time would be too tedious to rapidly iterate on for the players.

### The ideal person to filter for

This can be many types of people but here are some kinds of people who might be considered "ideal"

1. People who can build custom harnesses to go beyond what regular claudecode/codex/opencode etc can do. Think someone who can build something like this
   - [ramp's Inspect](https://builders.ramp.com/post/why-we-built-our-background-agent) that works in the background, can be triggered from anywhere like slack, jira etc.
   - [cursor's custom harness](https://x.com/mntruell/status/2028903020847841336) that built them a browser and gave a novel solution to the famous first proof challenge
   - [Anthropic's harness](https://www.anthropic.com/engineering/building-c-compiler) that built a C compiler

2. This can also mean filtering for someone who works like the creator of openclaw/clawdbot/moltbook [steipete](https://steipete.me/posts/2025/shipping-at-inference-speed). Essentially just opens up multiple codex windows and only reads code that matters, understands the "blast radius" of everything he does

3. My personal favourite would be someone that can push forward an organisation's engineering culture towards a [self driving code base](https://background-agents.com/). Essentially someone who can build a world where AI agents - triage bugs, come up with a minimal failing test case and then open a PR for it - debug ci failures no one wants to look at - fix flaky tests that no one bothers touching - keep all PRs/branches in sync with master by resolving conflicts
   and do all of this unprompted. Someone who can build good enough primitives inside the codebase and isolate things, and increase test coverage meaningfully so that low risk PRs that have a "low blast radius" can be merged once CI is green and an AI code reviewer approves.

## 3. Architecture and data flow

I did not want to just make v1 "harder". I wanted to broaden the surface area of what is being measured.

The current shape of v2 is a 3 level funnel:

1. Level 1 is is a scaled up version of v1, I decided to keep the spirit of fast algorithmic challenges from v1(there are some twists and gottcha's though, more on that later)

2. Level 2 asks source-diving questions across large real projects like Chromium, Firefox, LibreOffice and Postgres.

3. Level 3 is the most important addition. It turns the challenge into a real task where the candidate has to satisfy a spec in C, C++ or Rust and get through sample, smoke, hidden checks and benchmarks inside a native sandbox.(This involves security/architechture/perf/constraint heavy problems I have come across reading through patches on big OSS codebases, essentially everything that has a big blast radius not just in the particular codebase but also on everyone building on top of it)

This exists because Level 3 sandboxes are expensive to run, so the goal is to filter out many people in Level 1 and especially level 2.

At the product level the flow looks like this:

1. Candidate logs in with GitHub
2. Session is created and tied to identity/fingerprint data
3. Candidate plays through the current unlocked level
4. Validation and result events are recorded
5. Passing a level unlocks the next level
6. Reviewer telemetry and analytics get stored in Convex for later inspection

Architecturally I kept the stack pretty practical:

1. Next.js app for the product surface
2. Convex for state, leaderboard, sessions and telemetry
3. GitHub OAuth because identity matters a lot in a hiring funnel
4. QuickJS for the lightweight code validation path
5. Vercel Sandbox for the native execution path in Level 3

This felt like the right balance. It is real enough to be deployed and operated, but still lightweight enough that the company could actually adopt it next week if they wanted to.

## 4. Anti-gaming strategy

This was one of the things I optimized for.

v1 had some fun exploit mechanics so the anti-gaming model in v2 is layered..

### 1. Randomize questions on each run

lvl 1,2,3 serve questions from large datasets that can be scaled with more LLM tokens if needed(more on "industrializing" creating questions with llm skills below)

### 2. Abuse controls at the route level

The app now has route-specific abuse limits, identity keys, shadow-ban behavior and trusted fingerprint support. This is less glamorous than the challenge design itself, but it matters a lot. If the challenge can be spammed or brute forced from one box with no friction, then the scoring becomes noisy very quickly.

I do not think abuse prevention needs to be perfect here. It just needs to make mass probing and replaying meaningfully more expensive while keeping the experience smooth for honest candidates.

### 3. Session-specific assignment and hidden evaluation

v1 was much closer to a public puzzle box. Start a session, get a fixed kind of coding game, optimize hard, submit. That is fast and fun but also easier to reverse engineer.

In v2 the per-session new task assignment, multiple levels, multiple combination of problems and hidden checks reduce the usefulness of static answer sharing and hardcoding. Someone can still try to game it, but now they need a much more adaptive system to do so, and that is actually closer to what we want to measure.

### 5. Give reviewers evidence instead of pretending automation is enough

No anti-cheat system is perfect. The correct move is not to pretend it is. The correct move is to expose risk flags, identity evidence, suspicious sessions and operator review tools so a human can make the final call when something looks off.

## 5. Scoring and evaluation strategy

I think the biggest scoring mistake in challenges like this is when they collapse everything into a single number and then trust that number too much.

The leaderboard score still matters. Speed, correctness and difficulty still tell you something. But for a role like this, the score should be one signal among several, not the entire truth.

So the actual evaluation logic I am optimizing for is:

1. Can they clear Level 1 in a way that suggests they can operate under time pressure?
2. Can they do Level 2, which is much more about search strategy, retrieval quality and verification?
3. Can they survive Level 3, which is where harness quality and systems thinking matter most?
4. Did they trigger anti-cheat or injection-related risk flags?
5. What does the telemetry suggest about how they approached the challenge?

This is why the reviewer dashboard matters. The ideal outcome is not "fully automated ranking with fake precision". The ideal outcome is:

1. automation narrows the funnel
2. richer telemetry surfaces suspicious or exceptional cases
3. a human reviewer makes the last mile decision

The scoring is also intentionally level-shaped:

1. Level 1 still rewards correctness, difficulty, and time remaining. This preserves some of the game feel from v1.
2. Level 2 is a much better proxy for whether someone can aim agents at large real codebases and get grounded answers back.
3. Level 3 is the closest thing in this repo to actual harness engineering ability, because it forces the candidate to iterate against a spec and survive hidden checks in a native environment.

So if I had to summarize the philosophy in one sentence: I do not want to know who can prompt fastest, I want to know who can build the best loop.

## 6. What changed vs v1

the delta is pretty substantial.

v1 was basically:

1. one fast coding round
2. QuickJS validation
3. leaderboard-centric evaluation
4. some clever exploit / landmine mechanics
5. a much narrower view of candidate ability

In v2 I changed that in a few major ways:

1. It is now a 3-level progression instead of one coding sprint.
2. The middle of the challenge is source-diving, not just more code generation.
3. The final layer is native sandbox execution in C/C++/Rust with sample, smoke and hidden checks.
4. There is now real analytics, identity linking, abuse controls and reviewer telemetry.
5. The eval is much more focused on orchestration quality and harness engineering than pure speed.

What I kept from v1:

1. The web-native product shape
2. The fast feedback loop
3. The competitive/timed feel
4. The adversarial spirit of exploits and landmines

So this is not a total rejection of v1. It is more like taking the fun, sharp, game-like shell of v1 and then making the actual signal much more relevant to the kind of people the company probably wants to hire.

## 7. Tradeoffs and future work

There are definitely tradeoffs here.

### Tradeoffs

1. The infrastructure is more complex now. GitHub auth, Convex, abuse controls, analytics, and Vercel Sandbox are much more realistic than a toy challenge, but they also cost more to operate.
2. Manual review still matters. I think this is good, not bad, but it means the system is not purely self-serve for final hiring decisions.
3. Level 2 answer grading can still be made better. Source-diving questions are higher signal than toy coding, but answer normalization is always a bit messy.
4. Level 3 is much closer to real harness engineering, but it is still a bounded sandbox and not a messy long-running production environment.

### Future work

1. Require evidence-backed submissions for Level 2, not just final answers. I would love candidates to submit the grep/path/context that got them there.
2. Add a challenge mode that explicitly tests multi-agent decomposition and recovery from tool failures.
3. Make session generation even more dynamic so answer sharing decays faster over time.
4. Improve the telemetry dashboard with session playback, artifact inspection and maybe prompt/tool trace viewing.
5. Calibrate the challenge against actual hiring outcomes after a few cycles so the system gets tuned on real signal rather than vibes.

If I had more time, this is the main direction I would keep pushing: less "can you win a clever benchmark" and more "can you build agent systems that actually hold up under pressure".
