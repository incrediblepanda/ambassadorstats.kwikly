# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Full-stack **Kwikly Admin Portal** for managing ambassador referral dashboards with GetAmbassador API integration. Branded to match joinkwikly.com (Kwikly violet purple `#7B4FBF` primary color, clean white cards, Kwikly "K" logomark).

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Frontend**: React + Vite + Tailwind CSS + shadcn/ui
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Auth**: Session-based with bcryptjs, express-session

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server (auth, ambassadors, sync, settings, public dashboard)
│   └── admin/              # React+Vite admin frontend (login, dashboard, ambassadors, sync jobs, settings)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Key Features

- **Admin Authentication**: Session-based login with bcryptjs password hashing, session regeneration on login
- **Ambassador Management**: List with search/filter/pagination, detail view with KPI stats, iframe URL copy
- **Referral Tracking**: Professional and Company referral types, classified by custom field mapping
- **Sync Engine**: Manual sync trigger (FULL, AMBASSADORS_ONLY, REFERRALS_ONLY), job history tracking
- **Settings Management**: GetAmbassador API credentials, app base URL, sync toggle, connection test
- **Public Dashboard**: Embeddable dashboard route at `/api/public/dashboard/:shortCode`

## Database Schema

Tables: `admin_users`, `ambassadors`, `referrals`, `sync_jobs`, `app_settings`, `raw_api_payloads`

- Status values are **lowercase**: `"active"` / `"inactive"`
- Referral classification: `PROFESSIONAL` (no company fields) / `COMPANY` (has companyName/associatedOfficeId/totalShiftsWorked)
- Custom field mapping: `custom1`=companyName, `custom2`=totalShiftsWorked, `custom5`=numberShiftsWorked, `custom10`=associatedOfficeId
- `ambassadors` table GA financial/activity fields: `count_clicks`, `count_shares`, `total_money_earned`, `money_paid`, `money_pending`, `balance_money`, `enrolled_at`
- `ambassadors` table operational fields (nullable, future use): `job_title` (from GA API), `approved_at`, `shifts_count`, `total_shifts` (Kwikly internal — not in GA API)
- Leads page (prospects): 9-column table — First Name, Last Name, Email, Job Title, Referred By, Created At, Approved At, Shifts Worked, Total Shifts. GA API does not provide job title, approved_at, or shifts data for prospects; those columns show "—" until populated manually or via future Kwikly integration.

## Default Credentials

- Email: `justin@joinkwikly.com` (bootstrapped via ADMIN_BOOTSTRAP_EMAIL secret)
- Password: set via ADMIN_BOOTSTRAP_PASSWORD secret
- Fallback: `admin@example.com` / `admin123` (if no bootstrap secrets set)

## Environment Variables / Replit Secrets

Set these via the Replit Secrets panel. Env vars always take priority over values saved in the Settings UI.

| Secret | Required | Description |
|--------|----------|-------------|
| `SESSION_SECRET` | Yes | Session encryption key (defaults to insecure dev value if missing) |
| `GETAMBASSADOR_API_BASE_URL` | Yes (for live sync) | GetAmbassador API base URL |
| `GETAMBASSADOR_API_USERNAME` | Yes (for live sync) | GetAmbassador API username |
| `GETAMBASSADOR_API_TOKEN` | Yes (for live sync) | GetAmbassador API token |
| `APP_BASE_URL` | No | Base URL for public dashboard iframe links |
| `ADMIN_BOOTSTRAP_EMAIL` | No | Auto-creates admin user on startup |
| `ADMIN_BOOTSTRAP_PASSWORD` | No | Password for bootstrapped admin user |

On startup, the server logs which secrets are set and warns about any missing API credentials.
If `ADMIN_BOOTSTRAP_EMAIL`+`PASSWORD` are set, an admin user is auto-created/upserted on every startup.

## API Credential Lookup Priority

1. Replit Secrets (env vars: `GETAMBASSADOR_API_BASE_URL`, `GETAMBASSADOR_API_USERNAME`, `GETAMBASSADOR_API_TOKEN`)
2. Database settings (saved via Settings UI)

The Settings page shows "Replit Secret" badges on fields locked by env vars, and disables those inputs.

## API Routes

All routes prefixed with `/api`:
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`
- `GET /ambassadors`, `GET /ambassadors/:id`, `GET /ambassadors/:id/referrals`
- `POST /sync/trigger`, `GET /sync/jobs`
- `GET /settings`, `PUT /settings`, `POST /settings/test-connection`
- `GET /admin/stats`
- `GET /public/dashboard/:shortCode`

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

- **Always typecheck from the root** — run `pnpm run typecheck`
- **`emitDeclarationOnly`** — only emit `.d.ts` files during typecheck
- **Project references** — when package A depends on package B, A's `tsconfig.json` must list B in its `references` array

## Root Scripts

- `pnpm run build` — runs `typecheck` first, then recursively runs `build` in all packages
- `pnpm run typecheck` — runs `tsc --build --emitDeclarationOnly`

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server with auth, ambassador CRUD, sync engine, settings, and public dashboard routes.

- Entry: `src/index.ts` — reads `PORT`, starts Express
- App setup: `src/app.ts` — mounts CORS, JSON/urlencoded parsing, session middleware, routes at `/api`
- Routes: `src/routes/` — auth, ambassadors, sync, settings, public
- Services: `src/services/` — getambassador API client, sync engine
- Config: `src/config/field-mapping.ts` — custom field mapping for GetAmbassador data

### `artifacts/admin` (`@workspace/admin`)

React + Vite admin frontend with shadcn/ui components, React Query data fetching, wouter routing.

- Pages: login, dashboard, ambassadors list, ambassador detail, sync jobs, settings
- Auth: `src/hooks/use-auth.tsx` — ProtectedRoute component with session check
- Custom fetch: `src/lib/custom-fetch.ts` — adds `credentials: "include"` for session cookies

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

- `src/schema/index.ts` — all table definitions
- `drizzle.config.ts` — Drizzle Kit config (requires `DATABASE_URL`)
- Push schema: `pnpm --filter @workspace/db run push`

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config. Run codegen: `pnpm --filter @workspace/api-spec run codegen`

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

### `scripts` (`@workspace/scripts`)

Utility scripts. Run via `pnpm --filter @workspace/scripts run <script>`.
