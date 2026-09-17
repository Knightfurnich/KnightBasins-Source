# [Project name]

_Replace the heading above with the project's name, and this line with one sentence describing what this app does for users._

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

_Populate as you build — short repo map plus pointers to the source-of-truth file for DB schema, API contracts, theme files, etc._

## Architecture decisions

_Populate as you build — non-obvious choices a reader couldn't infer from the code (3-5 bullets)._

## Product

_Describe the high-level user-facing capabilities of this app once they exist._

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## GitHub Release Policy

- Push to `Knightfurnich/KnightBasins-Source` on `main` with the `GITHUB_TOKEN` secret through an ephemeral HTTPS remote; never print or persist the token.
- Include application code under `artifacts/knight-basins/src/`, `artifacts/api-server/src/`, and `lib/`.
- Include configuration files: `package.json`, `tsconfig.json`, `vite.config.ts`, `drizzle.config.ts`, and `.env.example`.
- Include tests and deployment files under `test/`, `deploy/`, and `.github/workflows/`. Workflow files require a token with GitHub workflow permission.
- Never push storefront/admin runtime uploads from `artifacts/knight-basins/public/uploads/`.
- Never push `.agents/`, `tmp/`, `screenshots/`, or `node_modules/`.
- Preserve the remote `main` history and avoid force-pushes. Verify the remote commit SHA after pushing.
- After a successful push, summarize the commit SHA and changed areas, then end the handoff with: `push ขึ้น GitHub แล้ว` so David can deploy to the production VPS.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
