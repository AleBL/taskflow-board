# Deploying TaskFlow Board to Vercel

This guide walks you through deploying TaskFlow Board to [Vercel](https://vercel.com) using [Turso](https://turso.tech) as the database.

---

## Prerequisites

- A [Vercel](https://vercel.com) account (free tier works)
- A [Turso](https://turso.tech) account (free tier: 500 databases, 9 GB storage)
- Node.js 18+ and pnpm installed locally

---

## Step 1 — Set up Turso

1. Sign up at [turso.tech](https://turso.tech)
2. Install the Turso CLI:
   ```bash
   curl -sSfL https://get.tur.so/install.sh | bash
   ```
3. Log in and create a database:
   ```bash
   turso auth login
   turso db create taskflow-board
   ```
4. Get your credentials:
   ```bash
   turso db show taskflow-board --url     # → TURSO_DATABASE_URL
   turso db tokens create taskflow-board  # → TURSO_AUTH_TOKEN
   ```

---

## Step 2 — Run Migrations

Create a `.env` file (copy from `env.example`) and fill in your credentials:

```bash
cp env.example .env
# Edit .env with TURSO_DATABASE_URL, TURSO_AUTH_TOKEN, and JWT_SECRET
```

Then run the migration:

```bash
pnpm install
pnpm db:migrate
```

Expected output:
```
✅ Applied: 0000_wakeful_expediter.sql
✅ Applied: 0001_deep_hellion.sql
🎉 All migrations applied successfully!
```

---

## Step 3 — Deploy to Vercel

### Option A — Vercel CLI

```bash
pnpm install -g vercel
vercel login
vercel --prod
```

When prompted, set these environment variables:
- `TURSO_DATABASE_URL` — your Turso database URL
- `TURSO_AUTH_TOKEN` — your Turso auth token
- `JWT_SECRET` — a random string (`openssl rand -hex 32`)

### Option B — Vercel Dashboard

1. Push your code to GitHub
2. Go to [vercel.com/new](https://vercel.com/new) and import your repository
3. Set the following **Environment Variables**:

   | Variable | Value |
   |---|---|
   | `TURSO_DATABASE_URL` | `libsql://your-db.turso.io` |
   | `TURSO_AUTH_TOKEN` | your token |
   | `JWT_SECRET` | random 32+ char string |

4. **Build Command**: `pnpm build:vercel`
5. **Output Directory**: `dist/public`
6. Click **Deploy**

---

## Step 4 — Verify

After deployment, visit your Vercel URL and:
1. Click **Register** to create an account
2. Create a project
3. Add tasks to the Kanban board

---

## Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `TURSO_DATABASE_URL` | ✅ | Turso libSQL URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | ✅ | Turso authentication token |
| `JWT_SECRET` | ✅ | Secret for signing session JWTs (min 32 chars) |

---

## Local Development

```bash
pnpm install
cp env.example .env   # fill in your credentials
pnpm db:migrate
pnpm dev              # http://localhost:3000
```

---

## Build Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Start development server with HMR |
| `pnpm build` | Build for self-hosted production (Express) |
| `pnpm build:vercel` | Build for Vercel (static + serverless API) |
| `pnpm test` | Run all Vitest tests |
| `pnpm db:migrate` | Apply database migrations to Turso |

---

## Architecture on Vercel

```
Vercel Edge
├── dist/public/          ← Static frontend (React SPA)
│   ├── index.html        ← All routes serve this (SPA fallback)
│   └── assets/           ← JS/CSS bundles
└── dist/api/index.js     ← Serverless function (Express + tRPC)
    └── /api/trpc/*       ← All API calls routed here
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + Vite + TailwindCSS 4 |
| Backend | Express 4 + tRPC 11 |
| Database | Turso (libSQL / SQLite) |
| ORM | Drizzle ORM |
| Auth | bcryptjs + JWT (jose) |
| i18n | i18next (PT-BR + EN) |
| Drag & Drop | @dnd-kit |
| Deploy | Vercel (serverless) |
