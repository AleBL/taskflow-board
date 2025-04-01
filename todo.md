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
- [ ] Add passwordHash column to users table and migrate
- [ ] Install bcryptjs + @types/bcryptjs
- [ ] Implement auth.register tRPC procedure
- [ ] Implement auth.login tRPC procedure (bcrypt verify + JWT)
- [ ] Implement auth.me and auth.logout procedures
- [ ] Remove all OAuth/Manus references from server
- [ ] Create Login page (email + password form)
- [ ] Create Register page
- [ ] Update useAuth hook to use local auth
- [ ] Protect routes: redirect to /login if not authenticated
- [ ] Write tests for register and login
