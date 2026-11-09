import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, and, like, desc, asc, inArray, lte, ne, isNotNull } from "drizzle-orm";
import { users, projects, tasks, comments, projectMembers } from "../drizzle/schema";
import type { InsertUser } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { DAY_MS, isTaskOverdue } from "../shared/dates";

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;

  const url = ENV.databaseUrl.trim() || ":memory:";
  const authToken = ENV.tursoAuthToken.trim();

  const client = createClient(
    url === ":memory:"
      ? { url: ":memory:" }
      : { url, authToken }
  );

  _db = drizzle(client);
  return _db;
}

export function resetDb() {
  _db = null;
}

export function setDb(db: ReturnType<typeof drizzle>) {
  _db = db;
}

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

export async function updateUser(
  id: number,
  data: Partial<{ name: string; passwordHash: string }>
) {
  const db = getDb();
  const result = await db
    .update(users)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(users.id, id))
    .returning();
  return result[0] ?? null;
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

export async function getProjectMembersList(projectId: number) {
  const db = getDb();
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: projectMembers.role,
      joinedAt: projectMembers.joinedAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(projectMembers.joinedAt))
    .all();
}

export async function isProjectMember(projectId: number, userId: number): Promise<boolean> {
  const db = getDb();
  const row = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .get();
  return row !== undefined;
}

export async function addProjectMember(projectId: number, userId: number, role: "owner" | "member" = "member") {
  const db = getDb();
  await db
    .insert(projectMembers)
    .values({ projectId, userId, role, joinedAt: new Date() })
    // No explicit target: still valid if migration 0003 (unique index) has not run yet.
    .onConflictDoNothing();
}

export async function removeProjectMember(projectId: number, userId: number) {
  const db = getDb();
  await db
    .update(tasks)
    .set({ assigneeId: null, updatedAt: new Date() })
    .where(and(eq(tasks.projectId, projectId), eq(tasks.assigneeId, userId)));
  const result = await db
    .delete(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .returning();
  return result[0] ?? null;
}

export async function getAccessibleProjectIds(userId: number): Promise<number[]> {
  const db = getDb();
  const rows = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(eq(projectMembers.userId, userId))
    .all();
  return rows.map((r) => r.projectId);
}

export async function getProjectsByUser(userId: number) {
  const db = getDb();
  const accessibleIds = await getAccessibleProjectIds(userId);
  if (accessibleIds.length === 0) return [];
  return db
    .select()
    .from(projects)
    .where(inArray(projects.id, accessibleIds))
    .orderBy(desc(projects.createdAt))
    .all();
}

export async function getProjectById(id: number, userId: number) {
  const db = getDb();
  const isMember = await isProjectMember(id, userId);
  if (!isMember) return null;
  return (await db.select().from(projects).where(eq(projects.id, id)).get()) ?? null;
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
  const project = result[0]!;

  // Auto-add the creator as owner member
  await addProjectMember(project.id, data.ownerId, "owner");

  return project;
}

export async function updateProject(
  id: number,
  userId: number,
  data: Partial<{ name: string; description: string | null; color: string }>
) {
  const db = getDb();
  const project = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .get();
  if (!project) return null;

  const result = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return result[0] ?? null;
}

export async function deleteProject(id: number, userId: number) {
  const db = getDb();
  const result = await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.ownerId, userId)))
    .returning();
  return result[0] ?? null;
}

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
  userId: number;
  search?: string;
  status?: "todo" | "in_progress" | "done";
  priority?: "low" | "medium" | "high";
  projectId?: number;
  overdue?: boolean;
}) {
  const db = getDb();

  const accessibleIds = await getAccessibleProjectIds(params.userId);
  if (accessibleIds.length === 0) return [];

  const conditions = [
    params.search ? like(tasks.title, `%${params.search}%`) : undefined,
    params.status ? eq(tasks.status, params.status) : undefined,
    params.priority ? eq(tasks.priority, params.priority) : undefined,
    params.projectId ? eq(tasks.projectId, params.projectId) : undefined,
    params.overdue ? ne(tasks.status, "done") : undefined,
    params.overdue ? isNotNull(tasks.dueDate) : undefined,
    params.overdue ? lte(tasks.dueDate, new Date(Date.now() - DAY_MS)) : undefined,
    inArray(tasks.projectId, accessibleIds),
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
  assigneeId?: number | null;
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
    assigneeId: number | null;
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
  if ("assigneeId" in data) updateData.assigneeId = data.assigneeId ?? null;

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

export async function getDashboardMetrics(userId: number) {
  const db = getDb();

  const accessibleIds = await getAccessibleProjectIds(userId);
  const totalProjects = accessibleIds.length;

  if (totalProjects === 0) {
    return { totalProjects: 0, total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 };
  }

  const allTasks = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      dueDate: tasks.dueDate,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(inArray(tasks.projectId, accessibleIds))
    .all();

  const now = Date.now();
  let todo = 0, inProgress = 0, done = 0, overdue = 0;

  for (const task of allTasks) {
    if (task.status === "todo") todo++;
    else if (task.status === "in_progress") inProgress++;
    else if (task.status === "done") done++;

    if (isTaskOverdue(task, now)) overdue++;
  }

  return { totalProjects, total: allTasks.length, todo, inProgress, done, overdue };
}
