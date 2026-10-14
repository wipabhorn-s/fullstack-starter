# fullstack-starter

A reusable starter for a NestJS API and a Next.js web app with authentication done properly.

- **api/**: NestJS 11, Prisma 7, PostgreSQL. Email/password and Google login, short-lived access tokens with rotating refresh tokens, and global guards for rate limiting, auth and roles.
- **web/**: Next.js 16 (App Router), next-auth v5, and shadcn (Base UI). Includes login, signup, a protected dashboard and an admin-only page.

Each app is its own pnpm project with its own lockfile. There's no root `package.json`.

Rules for humans and AI agents are in [AGENTS.md](AGENTS.md).

## Requirements

- **Node 24.15 or later** (24.x). Run `nvm use` in the repo root, which reads `.nvmrc`. Installs fail on other versions.
- **pnpm 11.8.0**. Run `corepack enable`, or `npm i -g pnpm@11.8.0`.
- **PostgreSQL 15 or later**: local, Docker, or hosted (Neon, Supabase…).

## Start a new project from this template

```bash
pnpm dlx degit wipabhorn-s/fullstack-starter my-app
```

Or use the `/new-project` Claude Code skill, which also renames packages, copies the `.env` files and installs.

## Setup

### 1. API

```bash
cd api
cp .env.example .env
```

Edit `api/.env`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Your Postgres connection string |
| `ACCESS_TOKEN_SECRET` | A random string of 32 or more characters. Generate one with `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | The first admin account. The password must have 8+ characters with upper, lower, a number and a symbol |
| `GOOGLE_CLIENT_ID` | Optional. Leave empty to disable Google login |
| `BREVO_API_KEY` / `MAIL_FROM` | Optional in dev, where emails are printed to the console. Required in production |

Then:

```bash
pnpm install                  # also generates the Prisma client
pnpm prisma migrate dev       # creates the tables
pnpm db:seed                  # creates the admin account
pnpm start:dev                # http://localhost:8000/health
```

### 2. Web

```bash
cd web
cp .env.example .env
```

Edit `web/.env`:

| Variable | Value |
|---|---|
| `API_URL` | `http://localhost:8000` |
| `AUTH_SECRET` | Generate one with `pnpm dlx auth secret`, or with the same `node -e …` command as above |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | Optional. Without both, the Google button is hidden |

```bash
pnpm install
pnpm dev                      # http://localhost:3000
```

Sign up at `/signup`, or log in as the seeded admin and open `/admin`.

### Google login (optional)

1. Go to Google Cloud Console → APIs & Services → Credentials and create an **OAuth client ID** of type *Web application*.
2. Add `http://localhost:3000/api/auth/callback/google` as an authorized redirect URI (plus your production URL).
3. Put the client ID in **both** `api/.env` and `web/.env`, and the secret in `web/.env` only.

## Everyday commands

Run these inside `api/` or `web/`. Always use pnpm, never `npx`.

| | api | web |
|---|---|---|
| Dev server | `pnpm start:dev` | `pnpm dev` |
| Lint | `pnpm lint` | `pnpm lint` |
| Unit tests | `pnpm test` | `pnpm test` |
| e2e tests (no DB needed) | `pnpm test:e2e` | — |
| Build | `pnpm build` | `pnpm build` |
| New migration | `pnpm prisma migrate dev --name <change>` | — |
| Prisma Studio | `pnpm prisma studio` | — |

## How auth works

```
Browser ──cookie──▶ Next.js (Server Components / Server Actions)
                       │  apiFetch + Bearer access token
                       ▼
                    NestJS ──▶ ThrottlerGuard ▶ AuthGuard ▶ RolesGuard ▶ controller
```

- The browser never talks to the API directly. next-auth keeps the API's tokens inside its encrypted session cookie.
- **Access tokens** last 15 minutes. Shortly before one expires, `web/src/proxy.ts` swaps the **refresh token** (30 days, rotated on every use, stored hashed) for a new pair.
- `AuthGuard` checks the database on every request. A deleted account or a revoked session gets `401 SESSION_INVALID`. A suspended account gets `403 ACCOUNT_SUSPENDED`. In both cases the web app signs the user out.
- Routes are **protected by default**. Mark exceptions with `@Public()`, and restrict routes with `@Roles(Role.ADMIN)`.

## Deploying

- **API:** build with `pnpm build`, run `pnpm prisma migrate deploy`, then start with `pnpm start:prod`. Set `NODE_ENV=production`, the mail settings, `TRUST_PROXY` (your web server's IP or subnet) and `INTERNAL_API_SECRET`. The health check is at `GET /health`.
- **Web:** set `AUTH_URL` to the public URL, and set `INTERNAL_API_SECRET` to the same value as the API.
