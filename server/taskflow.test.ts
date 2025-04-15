import { describe, it, expect, beforeEach } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { users, projects, tasks, comments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    openId TEXT NOT NULL UNIQUE,
    name TEXT,
    email TEXT UNIQUE,
    passwordHash TEXT,
    loginMethod TEXT,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    lastSignedIn INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT NOT NULL DEFAULT '#6366f1',
    ownerId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    dueDate INTEGER,
    completedAt INTEGER,
    position REAL NOT NULL DEFAULT 0,
    projectId INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assigneeId INTEGER REFERENCES users(id) ON DELETE SET NULL,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content TEXT NOT NULL,
    taskId INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    authorId INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    createdAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
    updatedAt INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  );
`;

async function createTestDb() {
  const client = createClient({ url: ":memory:" });

  for (const stmt of SCHEMA_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await client.execute(stmt);
  }
  return drizzle(client);
}

type TestDb = Awaited<ReturnType<typeof createTestDb>>;

async function seedUser(db: TestDb, openId = "user-1") {
  const result = await db
    .insert(users)
    .values({
      openId,
      name: "Test User",
      email: `test-${openId}@example.com`,
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    })
    .returning();
  return result[0]!;
}

async function seedProject(db: TestDb, ownerId: number, name = "Test Project") {
  const result = await db
    .insert(projects)
    .values({
      name,
      description: "A test project",
      color: "#6366f1",
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return result[0]!;
}

async function seedTask(
  db: TestDb,
  projectId: number,
  overrides: Partial<{ title: string; status: string; priority: string }> = {}
) {
  const result = await db
    .insert(tasks)
    .values({
      title: overrides.title ?? "Test Task",
      status: (overrides.status as "todo" | "in_progress" | "done") ?? "todo",
      priority: (overrides.priority as "low" | "medium" | "high") ?? "medium",
      position: 0,
      projectId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning();
  return result[0]!;
}

describe("Users", () => {
  it("inserts and retrieves a user by openId", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    expect(user.openId).toBe("user-1");
    expect(user.name).toBe("Test User");
    expect(user.role).toBe("user");
  });

  it("enforces unique openId constraint", async () => {
    const db = await createTestDb();
    await seedUser(db, "unique-id");
    await expect(seedUser(db, "unique-id")).rejects.toThrow();
  });
});

describe("Projects", () => {
  it("creates a project and retrieves it by owner", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    await seedProject(db, user.id);

    const found = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, user.id))
      .all();

    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("Test Project");
    expect(found[0].color).toBe("#6366f1");
  });

  it("deletes a project and cascades to tasks", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    await seedTask(db, project.id);

    await db.delete(projects).where(eq(projects.id, project.id));

    const remainingTasks = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id))
      .all();

    expect(remainingTasks).toHaveLength(0);
  });

  it("does not return projects from other users", async () => {
    const db = await createTestDb();
    const user1 = await seedUser(db, "user-1");
    const user2 = await seedUser(db, "user-2");
    await seedProject(db, user1.id, "User1 Project");
    await seedProject(db, user2.id, "User2 Project");

    const user1Projects = await db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, user1.id))
      .all();

    expect(user1Projects).toHaveLength(1);
    expect(user1Projects[0].name).toBe("User1 Project");
  });
});

describe("Tasks", () => {
  it("creates a task with default status and priority", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    const task = await seedTask(db, project.id);

    expect(task.status).toBe("todo");
    expect(task.priority).toBe("medium");
    expect(task.position).toBe(0);
  });

  it("creates tasks with different statuses", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);

    await seedTask(db, project.id, { status: "todo" });
    await seedTask(db, project.id, { status: "in_progress" });
    await seedTask(db, project.id, { status: "done" });

    const all = await db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id))
      .all();

    expect(all).toHaveLength(3);
    const statuses = all.map((t) => t.status);
    expect(statuses).toContain("todo");
    expect(statuses).toContain("in_progress");
    expect(statuses).toContain("done");
  });

  it("updates task status", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    const task = await seedTask(db, project.id);

    await db
      .update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(tasks.id, task.id));

    const updated = await db.select().from(tasks).where(eq(tasks.id, task.id)).get();
    expect(updated!.status).toBe("done");
    expect(updated!.completedAt).not.toBeNull();
  });

  it("deletes a task", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    const task = await seedTask(db, project.id);

    await db.delete(tasks).where(eq(tasks.id, task.id));

    const found = await db.select().from(tasks).where(eq(tasks.id, task.id)).get();
    expect(found).toBeUndefined();
  });
});

describe("Comments", () => {
  it("creates and retrieves a comment", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    const task = await seedTask(db, project.id);

    await db.insert(comments).values({
      content: "This is a comment",
      taskId: task.id,
      authorId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const found = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task.id))
      .all();

    expect(found).toHaveLength(1);
    expect(found[0].content).toBe("This is a comment");
  });

  it("cascades comment deletion when task is deleted", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    const task = await seedTask(db, project.id);

    await db.insert(comments).values({
      content: "Comment to be deleted",
      taskId: task.id,
      authorId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.delete(tasks).where(eq(tasks.id, task.id));

    const remaining = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task.id))
      .all();

    expect(remaining).toHaveLength(0);
  });

  it("does not delete comments from other tasks", async () => {
    const db = await createTestDb();
    const user = await seedUser(db);
    const project = await seedProject(db, user.id);
    const task1 = await seedTask(db, project.id, { title: "Task 1" });
    const task2 = await seedTask(db, project.id, { title: "Task 2" });

    await db.insert(comments).values({
      content: "Comment on task 1",
      taskId: task1.id,
      authorId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(comments).values({
      content: "Comment on task 2",
      taskId: task2.id,
      authorId: user.id,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await db.delete(tasks).where(eq(tasks.id, task1.id));

    const task2Comments = await db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task2.id))
      .all();

    expect(task2Comments).toHaveLength(1);
    expect(task2Comments[0].content).toBe("Comment on task 2");
  });
});
