import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { eq, and, like, desc, asc } from "drizzle-orm";
import { users, projects, tasks, comments } from "../drizzle/schema";
import type { InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";
import path from "path";
import fs from "fs";

// ─── Database connection ───────────────────────────────────────────────────────

function getDbPath(): string {
  const raw = process.env.DATABASE_URL ?? "";
  if (raw.startsWith("file:")) return raw.replace("file:", "");
  if (raw) return raw;
  const dir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "taskflow.db");
}

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (!_db) {
    const sqlite = new Database(getDbPath());
    sqlite.pragma("journal_mode = WAL");
    sqlite.pragma("foreign_keys = ON");
    _db = drizzle(sqlite);
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = getDb();
  const now = new Date();

  const existing = db
    .select()
    .from(users)
    .where(eq(users.openId, user.openId))
    .get();

  if (existing) {
    db.update(users)
      .set({
        name: user.name ?? existing.name,
        email: user.email ?? existing.email,
        loginMethod: user.loginMethod ?? existing.loginMethod,
        lastSignedIn: now,
        updatedAt: now,
      })
      .where(eq(users.openId, user.openId))
      .run();
  } else {
    const role =
      user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user");
    db.insert(users)
      .values({
        openId: user.openId,
        name: user.name ?? null,
        email: user.email ?? null,
        loginMethod: user.loginMethod ?? null,
        role,
        createdAt: now,
        updatedAt: now,
        lastSignedIn: now,
      })
      .run();
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  return db.select().from(users).where(eq(users.openId, openId)).get() ?? undefined;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export function getProjectsByOwner(ownerId: number) {
  const db = getDb();
  return db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.createdAt))
    .all();
}

export function getProjectById(id: number, ownerId: number) {
  const db = getDb();
  return (
    db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .get() ?? null
  );
}

export function createProject(data: {
  name: string;
  description: string | null;
  color: string;
  ownerId: number;
}) {
  const db = getDb();
  const now = new Date();
  return db
    .insert(projects)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning()
    .get()!;
}

export function updateProject(
  id: number,
  ownerId: number,
  data: Partial<{ name: string; description: string | null; color: string }>
) {
  const db = getDb();
  return (
    db
      .update(projects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .returning()
      .get() ?? null
  );
}

export function deleteProject(id: number, ownerId: number) {
  const db = getDb();
  return (
    db
      .delete(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .returning()
      .get() ?? null
  );
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export function getTasksByProject(projectId: number) {
  const db = getDb();
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.position), asc(tasks.createdAt))
    .all();
}

export function getTaskById(id: number) {
  const db = getDb();
  return db.select().from(tasks).where(eq(tasks.id, id)).get() ?? null;
}

export function searchTasks(params: {
  ownerId: number;
  search?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: number;
}) {
  const db = getDb();

  // Get project ids owned by this user
  const userProjectIds = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, params.ownerId))
    .all()
    .map((p) => p.id);

  if (userProjectIds.length === 0) return [];

  const all = db
    .select()
    .from(tasks)
    .where(
      and(
        params.search ? like(tasks.title, `%${params.search}%`) : undefined,
        params.status ? eq(tasks.status, params.status) : undefined,
        params.priority ? eq(tasks.priority, params.priority) : undefined,
        params.projectId ? eq(tasks.projectId, params.projectId) : undefined
      )
    )
    .orderBy(desc(tasks.createdAt))
    .all();

  return all.filter((t) => userProjectIds.includes(t.projectId));
}

export function createTask(data: {
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: Date | null;
  projectId: number;
}) {
  const db = getDb();
  const now = new Date();

  // Get max position in the same status column
  const existing = db
    .select({ position: tasks.position })
    .from(tasks)
    .where(and(eq(tasks.projectId, data.projectId), eq(tasks.status, data.status)))
    .orderBy(desc(tasks.position))
    .get();

  const position = existing ? existing.position + 1 : 0;

  return db
    .insert(tasks)
    .values({ ...data, position, createdAt: now, updatedAt: now })
    .returning()
    .get()!;
}

export function updateTask(
  id: number,
  data: Partial<{
    title: string;
    description: string | null;
    status: "todo" | "in_progress" | "done";
    priority: "low" | "medium" | "high";
    dueDate: Date | null;
    position: number;
  }>
) {
  const db = getDb();
  const now = new Date();

  const updateData: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) updateData.title = data.title;
  if (data.description !== undefined) updateData.description = data.description;
  if (data.status !== undefined) {
    updateData.status = data.status;
    updateData.completedAt = data.status === "done" ? now : null;
  }
  if (data.priority !== undefined) updateData.priority = data.priority;
  if (data.dueDate !== undefined) updateData.dueDate = data.dueDate;
  if (data.position !== undefined) updateData.position = data.position;

  return (
    db
      .update(tasks)
      .set(updateData)
      .where(eq(tasks.id, id))
      .returning()
      .get() ?? null
  );
}

export function deleteTask(id: number) {
  const db = getDb();
  return db.delete(tasks).where(eq(tasks.id, id)).returning().get() ?? null;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export function getCommentsByTask(taskId: number) {
  const db = getDb();
  return db
    .select({
      id: comments.id,
      content: comments.content,
      taskId: comments.taskId,
      authorId: comments.authorId,
      authorName: users.name,
      createdAt: comments.createdAt,
      updatedAt: comments.updatedAt,
    })
    .from(comments)
    .leftJoin(users, eq(comments.authorId, users.id))
    .where(eq(comments.taskId, taskId))
    .orderBy(asc(comments.createdAt))
    .all();
}

export function createComment(data: {
  taskId: number;
  content: string;
  authorId: number;
}) {
  const db = getDb();
  const now = new Date();
  return db
    .insert(comments)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning()
    .get()!;
}

export function deleteComment(id: number, authorId: number) {
  const db = getDb();
  return (
    db
      .delete(comments)
      .where(and(eq(comments.id, id), eq(comments.authorId, authorId)))
      .returning()
      .get() ?? null
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export function getDashboardMetrics(ownerId: number) {
  const db = getDb();

  const userProjects = db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .all();

  const totalProjects = userProjects.length;

  if (totalProjects === 0) {
    return { totalProjects: 0, total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 };
  }

  const projectIds = userProjects.map((p) => p.id);

  const allTasks = db
    .select({
      id: tasks.id,
      status: tasks.status,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .all()
    .filter((t) => projectIds.includes(t.projectId));

  const now = new Date();
  let todo = 0, inProgress = 0, done = 0, overdue = 0;

  for (const task of allTasks) {
    if (task.status === "todo") todo++;
    else if (task.status === "in_progress") inProgress++;
    else if (task.status === "done") done++;

    if (task.dueDate && task.dueDate < now && task.status !== "done") {
      overdue++;
    }
  }

  return {
    totalProjects,
    total: allTasks.length,
    todo,
    inProgress,
    done,
    overdue,
  };
}
