# CheetCode v2

CheetCode v2 is a Next.js + Convex challenge app for evaluating how well candidates run agents under pressure.

## Stack

- Next.js 16
- React 19
- Convex
- Auth.js / NextAuth GitHub OAuth
- `@vercel/sandbox` for Level 3 native execution
- Vitest + Playwright

## Prerequisites

- Node.js 24.x
- Yarn or npm
- A Convex account/project
- A GitHub OAuth app
- A Vercel account/project
- Vercel Sandbox credentials or snapshot configuration for Level 3

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Required:

- `NEXT_PUBLIC_CONVEX_URL`
- `CONVEX_MUTATION_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `AUTH_GITHUB_ID`
- `AUTH_GITHUB_SECRET`
- `AUTH_SECRET`
- `MY_ENV`

- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`

Level 3:

- `VERCEL_TOKEN`
- `VERCEL_TEAM_ID`
- `VERCEL_PROJECT_ID`

On Vercel production, Sandbox OIDC auth is preferred and access-token env vars are only needed outside Vercel.

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

Set the required app/auth values plus `MY_ENV=development`. `KV_REST_API_URL` and `KV_REST_API_TOKEN` are required for protected POST routes outside tests because the proxy enforces shared abuse/rate-limit state and Level 3 inflight locks through Upstash KV. For Level 3, also set Vercel Sandbox credentials when not using Vercel OIDC.

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

Deploy Convex with:

```bash
npx convex deploy
```

Then update production env vars so the frontend and API routes point at the same Convex environment.

## GitHub OAuth Setup

Create a GitHub OAuth app with:

- Homepage URL: your deployed app URL
- Callback URL: `https://your-domain/api/auth/callback/github`

Use its credentials for `AUTH_GITHUB_ID` / `AUTH_GITHUB_SECRET`, and set `AUTH_SECRET`.

Generate one with:

```bash
openssl rand -base64 32
```

## Vercel Deployment

Import the repo into Vercel and set:

- `NEXT_PUBLIC_CONVEX_URL`, `CONVEX_MUTATION_SECRET`
- `NEXT_PUBLIC_SITE_URL`
- `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET`, `AUTH_SECRET`
- `MY_ENV`
- `KV_REST_API_URL`, `KV_REST_API_TOKEN`
- `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`

Level 3 depends on `@vercel/sandbox`, and each validation now runs in a fresh sandbox created from a reusable snapshot. Production should use Vercel OIDC auth when available, otherwise provide `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, and `VERCEL_PROJECT_ID`. Upstash KV is required for protected POST routes in non-test environments, and it also stores abuse controls plus generated snapshot ids for reuse across instances.
