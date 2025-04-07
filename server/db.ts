import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, and, like, desc, asc, inArray } from "drizzle-orm";
import { users, projects, tasks, comments } from "../drizzle/schema";
import type { InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";

// ─── Database connection ───────────────────────────────────────────────────────

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = process.env.TURSO_DATABASE_URL ?? ":memory:";
  const authToken = process.env.TURSO_AUTH_TOKEN;

  const client = createClient(
    url === ":memory:"
      ? { url: ":memory:" }
      : { url, authToken }
  );

  _db = drizzle(client);
  return _db;
}

// Reset for tests
export function resetDb() {
  _db = null;
}

// Inject a pre-built db instance (used in tests)
export function setDb(db: ReturnType<typeof drizzle>) {
  _db = db;
}

// ─── Users ────────────────────────────────────────────────────────────────────

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required");
  const db = getDb();
  const now = new Date();

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.openId, user.openId))
    .get();

  if (existing) {
    await db
      .update(users)
      .set({
        name: user.name ?? existing.name,
        email: user.email ?? existing.email,
        loginMethod: user.loginMethod ?? existing.loginMethod,
        lastSignedIn: now,
        updatedAt: now,
      })
      .where(eq(users.openId, user.openId));
  } else {
    const role =
      user.openId === ENV.ownerOpenId ? "admin" : (user.role ?? "user");
    await db.insert(users).values({
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      role,
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    });
  }
}

export async function getUserByOpenId(openId: string) {
  const db = getDb();
  return (
    (await db.select().from(users).where(eq(users.openId, openId)).get()) ??
    undefined
  );
}

export async function getUserById(id: number) {
  const db = getDb();
  return (
    (await db.select().from(users).where(eq(users.id, id)).get()) ?? null
  );
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  return (
    (await db.select().from(users).where(eq(users.email, email)).get()) ?? null
  );
}

export async function createLocalUser(data: {
  name: string;
  email: string;
  passwordHash: string;
}) {
  const db = getDb();
  const now = new Date();
  const openId = `local:${data.email}`;
  const result = await db
    .insert(users)
    .values({
      openId,
      name: data.name,
      email: data.email,
      passwordHash: data.passwordHash,
      loginMethod: "local",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    })
    .returning();
  return result[0]!;
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export async function getProjectsByOwner(ownerId: number) {
  const db = getDb();
  return db
    .select()
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .orderBy(desc(projects.createdAt))
    .all();
}

export async function getProjectById(id: number, ownerId: number) {
  const db = getDb();
  return (
    (await db
      .select()
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
      .get()) ?? null
  );
}

export async function createProject(data: {
  name: string;
  description: string | null;
  color: string;
  ownerId: number;
}) {
  const db = getDb();
  const now = new Date();
  const result = await db
    .insert(projects)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning();
  return result[0]!;
}

export async function updateProject(
  id: number,
  ownerId: number,
  data: Partial<{ name: string; description: string | null; color: string }>
) {
  const db = getDb();
  const result = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .returning();
  return result[0] ?? null;
}

export async function deleteProject(id: number, ownerId: number) {
  const db = getDb();
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, ownerId)))
    .returning();
  return result[0] ?? null;
}

// ─── Tasks ────────────────────────────────────────────────────────────────────

export async function getTasksByProject(projectId: number) {
  const db = getDb();
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .orderBy(asc(tasks.position), asc(tasks.createdAt))
    .all();
}

export async function getTaskById(id: number) {
  const db = getDb();
  return (await db.select().from(tasks).where(eq(tasks.id, id)).get()) ?? null;
}

export async function searchTasks(params: {
  ownerId: number;
  search?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: number;
}) {
  const db = getDb();

  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, params.ownerId))
    .all();

  if (userProjects.length === 0) return [];
  const userProjectIds = userProjects.map((p) => p.id);

  const conditions = [
    params.search ? like(tasks.title, `%${params.search}%`) : undefined,
    params.status ? eq(tasks.status, params.status) : undefined,
    params.priority ? eq(tasks.priority, params.priority) : undefined,
    params.projectId ? eq(tasks.projectId, params.projectId) : undefined,
    inArray(tasks.projectId, userProjectIds),
  ].filter(Boolean);

  return db
    .select()
    .from(tasks)
    .where(and(...(conditions as Parameters<typeof and>)))
    .orderBy(desc(tasks.createdAt))
    .all();
}

export async function createTask(data: {
  title: string;
  description: string | null;
  status: "todo" | "in_progress" | "done";
  priority: "low" | "medium" | "high";
  dueDate: Date | null;
  projectId: number;
}) {
  const db = getDb();
  const now = new Date();

  const existing = await db
    .select({ position: tasks.position })
    .from(tasks)
    .where(
      and(eq(tasks.projectId, data.projectId), eq(tasks.status, data.status))
    )
    .orderBy(desc(tasks.position))
    .get();

  const position = existing ? existing.position + 1 : 0;

  const result = await db
    .insert(tasks)
    .values({ ...data, position, createdAt: now, updatedAt: now })
    .returning();
  return result[0]!;
}

export async function updateTask(
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

  const result = await db
    .update(tasks)
    .set(updateData)
    .where(eq(tasks.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deleteTask(id: number) {
  const db = getDb();
  const result = await db
    .delete(tasks)
    .where(eq(tasks.id, id))
    .returning();
  return result[0] ?? null;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export async function getCommentsByTask(taskId: number) {
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

export async function createComment(data: {
  taskId: number;
  content: string;
  authorId: number;
}) {
  const db = getDb();
  const now = new Date();
  const result = await db
    .insert(comments)
    .values({ ...data, createdAt: now, updatedAt: now })
    .returning();
  return result[0]!;
}

export async function deleteComment(id: number, authorId: number) {
  const db = getDb();
  const result = await db
    .delete(comments)
    .where(and(eq(comments.id, id), eq(comments.authorId, authorId)))
    .returning();
  return result[0] ?? null;
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export async function getDashboardMetrics(ownerId: number) {
  const db = getDb();

  const userProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.ownerId, ownerId))
    .all();

  const totalProjects = userProjects.length;

  if (totalProjects === 0) {
    return {
      totalProjects: 0,
      total: 0,
      todo: 0,
      inProgress: 0,
      done: 0,
      overdue: 0,
    };
  }

  const projectIds = userProjects.map((p) => p.id);

  const allTasks = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(inArray(tasks.projectId, projectIds))
    .all();

  const now = new Date();
  let todo = 0,
    inProgress = 0,
    done = 0,
    overdue = 0;

  for (const task of allTasks) {
    if (task.status === "todo") todo++;
    else if (task.status === "in_progress") inProgress++;
    else if (task.status === "done") done++;

    if (task.dueDate && task.dueDate < now && task.status !== "done") {
      overdue++;
    }
  }

  return { totalProjects, total: allTasks.length, todo, inProgress, done, overdue };
}
