# TaskFlow Board

A clean, focused Kanban task management application built with React, tRPC, and SQLite.

## Features

- **Authentication** — OAuth-based login via Manus Auth
- **Projects** — Create, edit, and delete projects with custom colors
- **Kanban Board** — Drag-and-drop tasks between To Do, In Progress, and Done columns
- **Tasks** — Full CRUD with title, description, priority, due date, and status
- **Comments** — Add and delete comments on tasks
- **Search & Filters** — Search tasks by title, filter by status, priority, and project
- **Dashboard** — Overview metrics: total tasks, by status, overdue count
- **Dark Theme** — Clean dark UI with sidebar navigation

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, TailwindCSS 4, shadcn/ui |
| Backend | Node.js, Express, tRPC 11 |
| Database | SQLite (via better-sqlite3 + Drizzle ORM) |
| Auth | Manus OAuth |
| Drag & Drop | @dnd-kit |
| Testing | Vitest |

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Database Setup

```bash
# Run migrations to create SQLite tables
pnpm db:migrate
```

### Development

```bash
pnpm dev
```

The app will be available at `http://localhost:3000`.

### Testing

```bash
pnpm test
```

### Build

```bash
pnpm build
```

## Project Structure

```
client/
  src/
    pages/          # Route-level pages (Dashboard, Projects, ProjectDetail, TaskSearch)
    components/     # Reusable components (TaskCard, TaskModal, DashboardLayout)
    lib/trpc.ts     # tRPC client binding
    App.tsx         # Routes & layout
drizzle/
  schema.ts         # Database schema (users, projects, tasks, comments)
  migrations/       # SQL migration files
server/
  db.ts             # SQLite query helpers
  routers.ts        # tRPC procedures (projects, tasks, comments, dashboard)
scripts/
  migrate.mjs       # Database migration runner
```

## Database Schema

```
users       — id, openId, name, email, role, ...
projects    — id, name, description, color, ownerId, ...
tasks       — id, title, description, status, priority, dueDate, position, projectId, ...
comments    — id, content, taskId, authorId, ...
```

## Deploying

This project uses SQLite, making it straightforward to deploy on platforms like:

- **Vercel** (with persistent storage via Vercel KV or a mounted volume)
- **Railway** (with a persistent volume for the SQLite file)
- **Fly.io** (with a volume mount)
- **Render** (with a disk)

> **Note:** For production, ensure the SQLite database file is stored on a persistent volume and not in the ephemeral filesystem.

## License

MIT
