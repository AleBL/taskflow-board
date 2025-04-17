# TaskFlow Board

A clean, focused Kanban task management application built with React, tRPC, and SQLite.

## Features

- **Projects** — Create, edit, and delete projects with custom colors
- **Kanban Board** — Drag-and-drop tasks between To Do, In Progress, and Done columns
- **Tasks** — Full CRUD with title, description, priority, due date, and status
- **Comments** — Add and delete comments on tasks
- **Search & Filters** — Search tasks by title, filter by status, priority, and project
- **Dashboard** — Overview metrics: total tasks, by status, overdue count
- **Dark Theme** — Clean dark UI with sidebar navigation

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **Frontend Framework** | React, TypeScript | React 19.2, TS 5.9 |
| **Build & Dev** | Vite, esbuild | Vite 7.1, esbuild 0.25 |
| **Styling** | TailwindCSS, Radix UI, shadcn/ui | TailwindCSS 4.1, Radix UI latest |
| **UI Components** | Lucide React (icons), Embla Carousel, Sonner (toast), Recharts | Latest |
| **Backend** | Node.js, Express, tRPC | Express 4.21, tRPC 11.6 |
| **Database** | Turso (LibSQL), Drizzle ORM | @libsql/client 0.17, Drizzle 0.45 |
| **Form & Validation** | React Hook Form, Zod | 7.64, 4.1 |
| **Query Management** | TanStack React Query | 5.90 |
| **Routing** | Wouter (lightweight router) | 3.3.5 |
| **Drag & Drop** | @dnd-kit | 6.3 (core), 10.0 (sortable) |
| **i18n** | i18next, react-i18next | 25.10, 16.6 |
| **Auth** | Jose (JWT), bcryptjs | 6.1, 3.0 |
| **Testing** | Vitest | 2.1 |
| **Linting** | ESLint, Prettier, TypeScript | ESLint 10.1, Prettier 3.6 |

## Getting Started

### Prerequisites

- Node.js 22+
- pnpm

#### Installing pnpm

If you don't have pnpm installed, you can install it globally:

```bash
# Using npm
npm install -g pnpm

# Using Homebrew (macOS)
brew install pnpm

# Using Scoop (Windows)
scoop install pnpm

# Using yarn
yarn global add pnpm
```

Verify the installation:

```bash
pnpm --version
```

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

## Database

**Architecture:** Turso (LibSQL) with Drizzle ORM for data access layer and migrations.

### Schema

```
users       — id, openId, name, email, role, ...
projects    — id, name, description, color, ownerId, ...
tasks       — id, title, description, status, priority, dueDate, position, projectId, ...
comments    — id, content, taskId, authorId, ...
```

## Deployment

**Database:** This project uses Turso (managed LibSQL), so there's no need to manage SQLite files in production.

Deploy to serverless platforms:

- **Vercel** — Connect to Turso database, deploy as Vercel Functions
- **Railway** — Easy database connection via environment variables
- **Fly.io** — Deploy container with env vars pointing to Turso
- **Render** — Similar to Railway, supports serverless Node deployments

**Environment Setup:**
Ensure `TURSO_CONNECTION_URL` and `TURSO_AUTH_TOKEN` are configured in your deployment platform.

## License

MIT
