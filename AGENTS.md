# Agent Guide

Full-stack starter: NestJS API + Next.js web, two independent pnpm projects (`api/`, `web/`) in one repo. No Turborepo, no root `package.json` — run every command inside the app's own folder.

**This file is the single source of rules.** `api/` and `web/` carry thin `CLAUDE.md` / `AGENTS.md` stubs that only `@`-import this file, so opening either folder on its own still loads it. Add rules here, never to the stubs.

## Tech stack

| Layer | Choice |
|---|---|
| API | NestJS 11, Prisma 7 (`@prisma/adapter-pg`), PostgreSQL |
| Web | Next.js 16 (App Router), React 19, next-auth v5 (beta) |
| UI | shadcn (`base-nova` style, Base UI primitives), Tailwind CSS v4, lucide-react |
| Forms | react-hook-form + zod |
| Validation | API DTOs: class-validator / class-transformer. zod only for env (both apps) and the web side |
| Auth | Email/password (bcrypt) + Google. JWT access token (15 min) + rotating refresh token |
| Mail | Brevo HTTP API; logs to console in dev when no key is set |
| Tests | API: Jest (+ supertest e2e). Web: Vitest + Testing Library |

Toolchain: **Node 24.x (>= 24.15)** and **pnpm 11.8.0**, pinned in `.nvmrc`, `packageManager`, and `engines`. `engineStrict: true` lives in each app's `pnpm-workspace.yaml` (pnpm 11 ignores `engine-strict` in `.npmrc`), so installing or running scripts on the wrong Node **fails rather than warns**. Run `nvm use` instead of overriding it.

The committed `pnpm-lock.yaml` in each app is the real version pin. `next`, `eslint-config-next`, `react`, `react-dom` and `next-auth` are pinned exactly — next-auth v5 is beta, don't bump it casually.

## Repo map

```
api/
  prisma/schema.prisma        data model (source of truth)
  prisma/migrations/          committed migrations — never edit an applied one
  prisma/seed.ts              first admin from SEED_ADMIN_* env
  src/config/env.validation.ts  every env var, validated with zod at boot
  src/database/               PrismaService (+ generated client, gitignored)
  src/common/decorator/       @Public @Roles @CurrentUser @Trim @NormalizeEmail @StrongPassword, throttle presets
  src/common/guards/          ClientIpThrottlerGuard
  src/auth/                   login/register/google/refresh/logout, token services, AuthGuard, RolesGuard
  src/users/                  UsersService (+ GET /users/me)
  src/admin/                  ADMIN-only endpoints
  src/infrastructure/         hash (bcrypt), jwt, mail
web/
  src/lib/env.ts              env validated with zod at import
  src/lib/api/                apiFetch + ApiError + one *.api.ts per API resource
  src/lib/actions/            Server Actions ("use server") — the only way the UI mutates data
  src/lib/auth.ts             next-auth config (Credentials + Google)
  src/lib/session-token.ts    token storage/refresh helpers
  src/proxy.ts                refreshes the access token before it expires
  src/app/(auth)/             /login, /signup (redirect away when logged in)
  src/app/(app)/              logged-in pages; (app)/admin requires role ADMIN
  src/components/ui/          shadcn components
```

## Commands

**Use pnpm for everything — never `npx` or `npm run`.** `npx` can resolve a different Prisma/Nest version than the lockfile, which is how a generated client and a schema quietly drift apart. Use `pnpm <script>`, `pnpm exec <bin>`, `pnpm prisma …`, and `pnpm dlx <pkg>` for one-off tools (e.g. `pnpm dlx shadcn@latest add dialog`).

| | `api/` | `web/` |
|---|---|---|
| dev | `pnpm start:dev` (port 8000) | `pnpm dev` (port 3000) |
| lint | `pnpm lint` (fixes) / `pnpm lint:check` (CI) | `pnpm lint` |
| test | `pnpm test`, `pnpm test:e2e` | `pnpm test` |
| build | `pnpm build` | `pnpm build` |

Finish every change with lint + test + build passing in each app you touched.

## Database / Prisma

- **Change the schema with `pnpm prisma migrate dev --name <what-changed>`** and commit the new folder in `prisma/migrations/` together with `schema.prisma`. Never use `db push` for anything that will be committed; never edit a migration that has already been applied anywhere.
- Deploy with `pnpm prisma migrate deploy`. CI applies all migrations to an empty Postgres and fails if they don't match `schema.prisma` (`migrate diff --exit-code`).
- The Prisma client is generated into `src/database/generated/` (gitignored) by `postinstall`. If the build says a model/field doesn't exist after pulling, run `pnpm prisma generate`.
- Naming: model PascalCase singular (`User`), table snake_case plural via `@@map("users")`, field camelCase with `@map("snake_case")` columns, enums PascalCase with SCREAMING_SNAKE members.
- `User` is **soft-deleted** (`deletedAt`). Every query that reads users must filter `deletedAt: null` — `UsersService` does; follow it.
- Never return a raw `User` row. Select `PUBLIC_USER_SELECT` (no `password`, `googleId`, `sessionVersion`).

## Auth and guards — what actually runs

Three global guards, registered with `APP_GUARD` in `app.module.ts`, **in this order**:

1. `ClientIpThrottlerGuard` — rate limit per real client IP, before anything touches the DB.
2. `AuthGuard` — **every route requires `Authorization: Bearer <accessToken>` unless marked `@Public()`.** After verifying the JWT it loads the account (one indexed select per request — keep it):
   - deleted, or token `ver` ≠ `User.sessionVersion` → `401 { code: "SESSION_INVALID" }`
   - `status: SUSPENDED` → `403 { code: "ACCOUNT_SUSPENDED" }`
3. `RolesGuard` — `@Roles(Role.ADMIN)` on a controller or handler. No decorator = any logged-in user.

Rules:

- Secure by default: a new controller is protected automatically. Only add `@Public()` deliberately, and put sensitive public endpoints under a throttle preset (`@CredentialThrottle()`, `@EmailThrottle()`, `@RefreshThrottle()`).
- Get the caller with `@CurrentUser()` / `@CurrentUser('sub')`, never from a header or the body. Authorize ownership in the service.
- Access tokens can't be revoked, which is why `AuthGuard` checks the DB. To kill every session of a user immediately, call `RefreshTokenService.revokeAllForUser()` (revokes refresh tokens **and** bumps `sessionVersion`). Suspending only revokes refresh tokens so the user sees `ACCOUNT_SUSPENDED`, not a generic expiry.
- Refresh tokens are stored as sha256, rotated on every use; reusing an old one after the 30 s grace window revokes the whole family (`REFRESH_REUSED`).
- Login answers the same message and the same timing for "no such email", "Google-only account" and "wrong password". Keep it that way.
- Errors the web needs to branch on carry a stable `code` (`throw new ForbiddenException({ message, code })`). The web keeps it on `ApiError.code` — branch on `code`, never on `message`.
- Password rules live in two places that must match: `api/src/common/decorator/strong-password.decorator.ts` and `web/src/lib/schemas/password.schema.ts`.

## API conventions

- Global `ValidationPipe({ whitelist: true, transform: true })`: every body/query is a DTO class with class-validator decorators. Unknown fields are stripped, so you never need to defend against `role: 'ADMIN'` in a body — but only if the DTO doesn't declare it.
- Use `@Trim()` on free-text strings and `@NormalizeEmail()` on emails. Query numbers need `@Type(() => Number)`.
- Module dir kebab-case plural (`src/users/`), classes `UsersService` / `UsersController`, DTO files `create-user.dto.ts` → `CreateUserDto`, paths kebab-case plural nouns.
- New env var: add it to `src/config/env.validation.ts` **and** `.env.example` (with a comment) in the same change. Read it through `ConfigService<EnvVariable, true>` with `{ infer: true }`. Optional values use the `optionalString` helper so a blank `KEY=` line counts as unset.

## Web conventions

- **The browser never calls the API.** Server Components read with `*.api.ts` helpers; mutations go through Server Actions in `src/lib/actions/`. Both use `apiFetch`, which adds the bearer token, forwards the client IP, and retries GETs while the API wakes up. CORS is off on purpose.
- `apiFetch` with a `token` that gets `401` (or `403 ACCOUNT_SUSPENDED`) redirects to `/session-expired`, which revokes the refresh token and signs out. Don't catch that redirect.
- Server Actions return `ErrorActionResult` (`{ success: false, message, code }`) instead of throwing for expected failures, and re-validate input with zod — anything from the browser is untrusted.
- Page guards (`auth()` in layouts) only hide pages. The API is the real authority — never skip a server-side check because the UI hides a button.
- Never expose the access token to client components. `/api/auth/session` strips it; don't add `useSession` code that depends on it.
- Forms: react-hook-form + `zodResolver`, schemas in `src/lib/schemas/`, `Controller` + `Field` components as in `LoginForm.tsx`.
- UI: add components with `pnpm dlx shadcn@latest add <name>`; theme tokens live in `src/app/globals.css` — don't hardcode colors.
- `web/AGENTS.md` contains a block between `BEGIN:nextjs-agent-rules` and `END:nextjs-agent-rules` that `next dev` rewrites. Never edit inside it.

## Code comments

Comment the **non-obvious** — why a check exists, what breaks without it, a trade-off — **in Thai**, matching the existing code. Don't comment what the code already says.

## Git

- Work on a branch; don't commit straight to `main` unless the user says so. Commit or push only when asked.
- Commit `pnpm-lock.yaml` with any `package.json` change — CI installs with `--frozen-lockfile`.
- Never commit `.env` files, secrets, or `src/database/generated/`.

## CI

`.github/workflows/ci.yml` runs per app on PRs and pushes to `main`: install (`--frozen-lockfile`), lint, test, build. The API job also starts a throwaway Postgres to apply migrations, check them against the schema, and run e2e. Make it a required status check; if it's red, fix the branch — don't merge around it.
