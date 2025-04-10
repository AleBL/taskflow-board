# TaskFlow Board — TODO

## Setup & Infrastructure
- [x] Initialize project scaffold (web-db-user)
- [x] Configure Git identity (Alessandro Barros)
- [x] Create GitHub repository (AleBL/taskflow-board)
- [x] Install better-sqlite3 + drizzle-orm SQLite adapter
- [x] Install @dnd-kit for drag-and-drop
- [x] Update drizzle.config.ts for SQLite
- [x] Update server/db.ts for SQLite
- [x] Create SQLite schema (projects, tasks, comments)
- [x] Run migrations and apply SQL

## Backend — tRPC Routers
- [x] projects router (list, getById, create, update, delete)
- [x] tasks router (list, getById, create, update, delete, updateStatus, search)
- [x] comments router (list, create, delete)
- [x] dashboard router (metrics: total, by status, overdue)

## Frontend — Pages & Components
- [x] Dark theme setup in index.css and App.tsx
- [x] DashboardLayout with sidebar navigation (TaskFlow branding)
- [x] Dashboard page with metrics cards and recent projects
- [x] Projects list page (CRUD with color picker)
- [x] Project detail page with Kanban board
- [x] Kanban board with drag-and-drop between columns (@dnd-kit)
- [x] TaskCard component (priority badge, due date, overdue indicator)
- [x] TaskModal component (create/edit + comments section)
- [x] TaskSearch page with search + filters (status, priority, project)

## Quality
- [x] Vitest tests: users, projects, tasks, comments (13 tests passing)
- [x] Auth logout test preserved
- [x] README.md with setup, tech stack, and deployment notes

## Local Authentication (replacing OAuth)
- [x] Add passwordHash column to users table and migrate
- [x] Install bcryptjs + @types/bcryptjs
- [x] Implement auth.register tRPC procedure
- [x] Implement auth.login tRPC procedure (bcrypt verify + JWT)
- [x] Implement auth.me and auth.logout procedures
- [x] Remove all OAuth/Manus references from server
- [x] Create Login page (email + password form)
- [x] Create Register page
- [x] Update useAuth hook to use local auth
- [x] Protect routes: redirect to /login if not authenticated
- [x] Write tests for register and login

## Bug Fixes
- [x] Fix "Cannot open database because the directory does not exist" on register/login

## Internationalization (i18n)
- [x] Install i18next + react-i18next + i18next-browser-languagedetector
- [x] Create translation files: en.json and pt-BR.json
- [x] Configure i18n provider in main.tsx
- [x] Add language switcher component (EN/PT-BR)
- [x] Translate all pages: Login, Register, Home, Dashboard, Projects, ProjectDetail, TaskSearch
- [x] Translate DashboardLayout sidebar and header
- [x] Translate TaskModal and TaskCard components

## Vercel Deploy
- [x] Create vercel.json with build and route config
- [x] Create api/index.ts serverless entry point
- [x] Update package.json scripts for Vercel
- [x] Create env.example with required variables
- [x] Create DEPLOY.md with step-by-step Vercel instructions
- [x] Export project as ZIP for user import

## Bug Fixes (Round 2)
- [x] Fix: session cookie not sent after login (UNAUTHORIZED on dashboard/projects)

## Database Migration (better-sqlite3 → Turso/libSQL)
- [ ] Install @libsql/client + drizzle-orm/libsql
- [ ] Remove better-sqlite3 dependency
- [ ] Update drizzle.config.ts for libSQL
- [ ] Rewrite server/db.ts to use libSQL client
- [ ] Update scripts/migrate.mjs for Turso
- [ ] Apply migrations to Turso remote database
- [ ] Update tests to use in-memory libSQL
- [ ] Commit and push changes

## Bug Fixes (Round 3)
- [x] Fix: untranslated texts in Home.tsx (landing page)
- [x] Fix: untranslated texts in DashboardLayout unauthenticated screen
- [x] Fix: audit and translate all remaining hardcoded English strings (TaskCard priority labels, ErrorBoundary)
