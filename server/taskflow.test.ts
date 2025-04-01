import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { users, projects, tasks, comments } from "../drizzle/schema";
import { eq } from "drizzle-orm";

// ─── In-memory DB setup ───────────────────────────────────────────────────────

function createTestDb() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("foreign_keys = ON");
  sqlite.exec(`
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
  `);
  return drizzle(sqlite);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function seedUser(db: ReturnType<typeof drizzle>, openId = "user-1") {
  return db
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
    .returning()
    .get()!;
}

function seedProject(
  db: ReturnType<typeof drizzle>,
  ownerId: number,
  name = "Test Project"
) {
  return db
    .insert(projects)
    .values({
      name,
      description: "A test project",
      color: "#6366f1",
      ownerId,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .returning()
    .get()!;
}

function seedTask(
  db: ReturnType<typeof drizzle>,
  projectId: number,
  overrides: Partial<{ title: string; status: string; priority: string }> = {}
) {
  return db
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
    .returning()
    .get()!;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Users", () => {
  it("inserts and retrieves a user by openId", () => {
    const db = createTestDb();
    const user = seedUser(db);
    expect(user.openId).toBe("user-1");
    expect(user.name).toBe("Test User");
    expect(user.role).toBe("user");
  });

  it("enforces unique openId constraint", () => {
    const db = createTestDb();
    seedUser(db, "unique-id");
    expect(() => seedUser(db, "unique-id")).toThrow();
  });
});

describe("Projects", () => {
  it("creates a project and retrieves it by owner", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);

    const found = db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, user.id))
      .all();

    expect(found).toHaveLength(1);
    expect(found[0].name).toBe("Test Project");
    expect(found[0].color).toBe("#6366f1");
  });

  it("deletes a project and cascades to tasks", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);
    seedTask(db, project.id);

    db.delete(projects).where(eq(projects.id, project.id)).run();

    const remainingTasks = db
      .select()
      .from(tasks)
      .where(eq(tasks.projectId, project.id))
      .all();

    expect(remainingTasks).toHaveLength(0);
  });

  it("does not return projects from other users", () => {
    const db = createTestDb();
    const user1 = seedUser(db, "user-1");
    const user2 = seedUser(db, "user-2");
    seedProject(db, user1.id, "User1 Project");
    seedProject(db, user2.id, "User2 Project");

    const user1Projects = db
      .select()
      .from(projects)
      .where(eq(projects.ownerId, user1.id))
      .all();

    expect(user1Projects).toHaveLength(1);
    expect(user1Projects[0].name).toBe("User1 Project");
  });
});

describe("Tasks", () => {
  it("creates a task with default status and priority", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);
    const task = seedTask(db, project.id);

    expect(task.status).toBe("todo");
    expect(task.priority).toBe("medium");
    expect(task.position).toBe(0);
  });

  it("creates tasks with different statuses", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);

    seedTask(db, project.id, { status: "todo" });
    seedTask(db, project.id, { status: "in_progress" });
    seedTask(db, project.id, { status: "done" });

    const all = db
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

  it("updates task status", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);
    const task = seedTask(db, project.id);

    db.update(tasks)
      .set({ status: "done", completedAt: new Date() })
      .where(eq(tasks.id, task.id))
      .run();

    const updated = db.select().from(tasks).where(eq(tasks.id, task.id)).get()!;
    expect(updated.status).toBe("done");
    expect(updated.completedAt).not.toBeNull();
  });

  it("deletes a task", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);
    const task = seedTask(db, project.id);

    db.delete(tasks).where(eq(tasks.id, task.id)).run();

    const found = db.select().from(tasks).where(eq(tasks.id, task.id)).get();
    expect(found).toBeUndefined();
  });
});

describe("Comments", () => {
  it("creates and retrieves a comment", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);
    const task = seedTask(db, project.id);

    db.insert(comments)
      .values({
        content: "This is a comment",
        taskId: task.id,
        authorId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    const found = db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task.id))
      .all();

    expect(found).toHaveLength(1);
    expect(found[0].content).toBe("This is a comment");
  });

  it("cascades comment deletion when task is deleted", () => {
    const db = createTestDb();
    const user = seedUser(db);
    const project = seedProject(db, user.id);
    const task = seedTask(db, project.id);

    db.insert(comments)
      .values({
        content: "Will be deleted",
        taskId: task.id,
        authorId: user.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .run();

    db.delete(tasks).where(eq(tasks.id, task.id)).run();

    const remaining = db
      .select()
      .from(comments)
      .where(eq(comments.taskId, task.id))
      .all();

    expect(remaining).toHaveLength(0);
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { appRouter } = await import("./routers");
    const { COOKIE_NAME } = await import("../shared/const");
    type TrpcContext = import("./_core/context").TrpcContext;

    const clearedCookies: { name: string; options: Record<string, unknown> }[] = [];

    const user: NonNullable<TrpcContext["user"]> = {
      id: 1,
      openId: "sample-user",
      email: "sample@example.com",
      passwordHash: null,
      name: "Sample User",
      loginMethod: "local",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const ctx: TrpcContext = {
      user,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        clearCookie: (name: string, options: Record<string, unknown>) => {
          clearedCookies.push({ name, options });
        },
      } as TrpcContext["res"],
    };

    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearedCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});
