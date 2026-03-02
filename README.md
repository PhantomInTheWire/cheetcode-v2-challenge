# CheetCode

CheetCode is a fast coding game built to evaluate how well AI agents can solve and orchestrate under pressure.

This repository contains the original CheetCode implementation used in hiring experiments and now serves as the base for the next challenge iteration.

## CheetCode v2 Candidate Challenge

If you were invited to the take-home challenge, read [CHALLENGE.md](./CHALLENGE.md) first.

The challenge asks candidates to fork this repository and design a better CheetCode variant that:

- is harder for agents to game
- better identifies strong agent orchestrators
- is fully deployed and runnable

## Quick start

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

## Scripts

```bash
npm run dev
npm run test
npm run lint
```

## Tech stack

- Next.js app in `src/`
- Convex functions and schema in `convex/`
- Problem bank in `server/level1/problems.ts`
- QuickJS-based validation in API routes

## Notes

- Use environment variables for secrets and deployment config.
- Do not commit `.env` files.
