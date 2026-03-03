# CheetCode v2

CheetCode v2 is a Next.js + Convex challenge app for evaluating how well candidates run agents under pressure.

It includes:

- GitHub-authenticated game sessions
- Convex-backed session, leaderboard, lead, and telemetry storage
- QuickJS sandbox validation for Level 1
- Chromium/source-analysis challenge flow for Level 2
- Native compile-and-harness execution for Level 3 via Vercel Sandbox

If you are taking the candidate challenge, read [CHALLENGE.md](./CHALLENGE.md) first.

## Stack

- Next.js 16
- React 19
- Convex
- Auth.js / NextAuth GitHub OAuth
- `@vercel/sandbox` for Level 3 native execution
- Vitest + Playwright

## Prerequisites

You need all of the following installed/configured before this app will run end to end:

- Node.js 24.x
- Yarn or npm
- A Convex account/project
- A GitHub OAuth app
- A Vercel account/project
- Vercel Sandbox credentials or snapshot configuration for Level 3

## Environment Variables

Copy `.env.example` to `.env.local` and fill in real values:

```bash
cp .env.example .env.local
```

Required app/runtime variables:

- `NEXT_PUBLIC_CONVEX_URL`
  Convex deployment URL used by the client and server routes.
- `CONVEX_MUTATION_SECRET`
  Shared secret used by server-side routes when calling authenticated Convex actions.
- `AUTH_GITHUB_ID`
  GitHub OAuth client id.
- `AUTH_GITHUB_SECRET`
  GitHub OAuth client secret.
- `AUTH_SECRET`
  Auth.js session secret.
- `MY_ENV`
  Set to `development` locally if you want dev-only helpers like auto-solve routes.

Level 3 / Vercel Sandbox variables:

- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID`

Optional but strongly recommended for faster Level 3 cold start:

- `VERCEL_SANDBOX_SNAPSHOT_CLANG`
- `VERCEL_SANDBOX_SNAPSHOT_RUST`

These snapshots are used by `server/level3/validation.ts` to boot prebuilt sandbox runtimes instead of provisioning toolchains from scratch on demand.

## Local Development

### 1. Install dependencies

```bash
yarn install
```

### 2. Create a Convex dev deployment

```bash
npx convex dev
```

This provisions a Convex dev deployment and updates `.env.local` with:

- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`

If Convex type generation or typecheck fails, fix the reported TypeScript errors before continuing.

### 3. Fill the rest of `.env.local`

At minimum, set:

- `CONVEX_MUTATION_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_SECRET`
- `MY_ENV=development` for local testing

For Level 3, also set either:

- `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`

or pre-created sandbox snapshot ids:

- `VERCEL_SANDBOX_SNAPSHOT_CLANG`
- `VERCEL_SANDBOX_SNAPSHOT_RUST`

### 4. Start the app

```bash
yarn dev
```

Open [http://localhost:3000](http://localhost:3000).

## Build

Run a production build locally:

```bash
yarn build
```

Start the production server:

```bash
yarn start
```

## Test and Verification

Run the main checks:

```bash
yarn lint
yarn staticcheck
yarn test
```

Run the stricter repo check:

```bash
yarn verify:strict
```

Run browser tests:

```bash
yarn test:e2e
```

Useful scripts:

```bash
yarn dev
yarn build
yarn start
yarn lint
yarn staticcheck
yarn test
yarn test:e2e
yarn verify
yarn verify:strict
```

## Convex Deployment

This repo uses Convex for:

- session creation/restoration
- leaderboard state
- lead capture
- attempt telemetry and review queries

To deploy Convex:

```bash
npx convex deploy
```

After deploying, update your environment variables with the production values:

- `CONVEX_DEPLOYMENT`
- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_MUTATION_SECRET`

Make sure your frontend deployment and Convex deployment point at the same environment.

## GitHub OAuth Setup

Create a GitHub OAuth app and configure:

- Homepage URL: your deployed app URL
- Authorization callback URL:
  `https://your-domain/api/auth/callback/github`

Use the resulting values for:

- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`

Also set:

- `AUTH_SECRET`

Generate one with:

```bash
openssl rand -base64 32
```

## Vercel Deployment

The frontend/API app is intended to run on Vercel.

### 1. Create a Vercel project

Import the repo into Vercel and configure the production environment variables:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_MUTATION_SECRET`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_SECRET`
- `MY_ENV`
- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID`
- optionally `VERCEL_SANDBOX_SNAPSHOT_CLANG`
- optionally `VERCEL_SANDBOX_SNAPSHOT_RUST`

### 2. Important Vercel Sandbox notes

Level 3 depends on `@vercel/sandbox` in `server/level3/validation.ts`.

That means:

- your deployment must have valid Vercel sandbox credentials
- the project must be allowed to create/use sandboxes
- Level 3 will fail if sandbox credentials or snapshot configuration are missing

Cold start behavior:

- If `VERCEL_SANDBOX_SNAPSHOT_CLANG` / `VERCEL_SANDBOX_SNAPSHOT_RUST` are configured, the app will try to boot from those snapshots first.
- If snapshots are missing but credentials exist, the app can build snapshots dynamically.
- Snapshot-backed startup is preferred because it reduces Level 3 initialization cost.

### 3. Recommended production setup for Level 3

Use a warm snapshot path in production:

1. Provision a sandbox with the needed toolchains.
2. Create snapshots for:
   - clang/C/C++
   - rust
3. Store their ids in:
   - `VERCEL_SANDBOX_SNAPSHOT_CLANG`
   - `VERCEL_SANDBOX_SNAPSHOT_RUST`

Without this, Level 3 may still work, but startup will be slower and more failure-prone.

## Deployment Checklist

Before calling the app deployed:

- `yarn verify:strict` passes locally
- `npx convex deploy` completed successfully
- Vercel env vars are set correctly
- GitHub OAuth callback URL matches the deployed domain
- `NEXT_PUBLIC_CONVEX_URL` points to the intended Convex environment
- `CONVEX_MUTATION_SECRET` matches the value expected by the deployed app routes
- Level 3 sandbox credentials and/or snapshot ids are configured
- Sign-in, session creation, validation, finish routes, and Level 3 execution work in production

## Repo Structure

- `src/app/`
  Next.js app routes and API routes
- `src/components/`
  Game UI and client-side flows
- `src/hooks/`
  Stateful game orchestration hooks
- `src/lib/`
  Shared runtime, auth, telemetry, scoring, and validation helpers
- `convex/`
  Convex schema and functions
- `server/`
  Problem banks and Level 3 validation runtime

## Notes

- Do not commit `.env.local`.
- Convex type generation is part of normal development; if `npx convex dev` or `npx convex deploy` reports type failures, fix them before shipping.
- The app uses Vercel-specific infrastructure for Level 3; if you remove Vercel Sandbox, you will need to replace that execution path.
