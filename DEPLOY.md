# Deploying TaskFlow Board to Vercel

This guide explains how to deploy TaskFlow Board to Vercel using the included configuration.

---

## Prerequisites

- A [Vercel account](https://vercel.com/signup) (free tier works)
- The project pushed to a GitHub repository

---

## Step 1 — Push to GitHub

```bash
git remote add origin https://github.com/<your-username>/taskflow-board.git
git push -u origin main
```

---

## Step 2 — Import on Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **"Import Git Repository"** and select `taskflow-board`
3. Vercel will auto-detect the `vercel.json` configuration

---

## Step 3 — Set Environment Variables

In the Vercel project settings → **Environment Variables**, add:

| Variable       | Value                                      | Notes                                  |
|----------------|--------------------------------------------|----------------------------------------|
| `JWT_SECRET`   | A random 32-char string                    | `openssl rand -base64 32`              |
| `SQLITE_PATH`  | `/tmp/taskflow.db`                         | Vercel uses `/tmp` for writable files  |
| `NODE_ENV`     | `production`                               | Set automatically by Vercel            |

> **Important about SQLite on Vercel:**
> Vercel's serverless functions are **stateless** — the `/tmp` directory is ephemeral and resets between cold starts.
> For a production app with persistent data, consider:
> - [Turso](https://turso.tech/) — SQLite-compatible edge database (free tier available)
> - [PlanetScale](https://planetscale.com/) — MySQL-compatible serverless DB
> - [Railway](https://railway.app/) — Persistent SQLite with volumes

---

## Step 4 — Deploy

Click **"Deploy"**. Vercel will:
1. Run `pnpm install`
2. Run `pnpm build:vercel` (builds frontend + serverless API)
3. Serve `dist/public/` as static files
4. Route `/api/*` requests to `dist/api/index.js`

---

## Local Development

```bash
# Install dependencies
pnpm install

# Run database migrations
pnpm db:migrate

# Start dev server (http://localhost:3000)
pnpm dev
```

---

## Build Scripts

| Script             | Description                                    |
|--------------------|------------------------------------------------|
| `pnpm dev`         | Start development server with HMR              |
| `pnpm build`       | Build for self-hosted production (Express)     |
| `pnpm build:vercel`| Build for Vercel (static + serverless API)     |
| `pnpm test`        | Run all Vitest tests                           |
| `pnpm db:migrate`  | Apply SQLite migrations                        |

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
