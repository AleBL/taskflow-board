import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  comments,
  projectMembers,
  projects,
  tasks,
  users,
} from "../drizzle/schema";
import { COOKIE_NAME, DEMO_SESSION_MAX_AGE_MS } from "../shared/const";
import {
  DAY_MS,
  fromDateInputValue,
  isTaskOverdue,
  toDateInputValue,
} from "../shared/dates";
import { verifySession } from "./auth";
import { getUserByEmail, getUserById } from "./db";
import { cleanupExpiredDemos } from "./demo";
import { appRouter } from "./routers";
import { createTestContext, setupTestDb } from "./testDb";

let testDb: Awaited<ReturnType<typeof setupTestDb>>;

beforeAll(async () => {
  testDb = await setupTestDb();
});

afterAll(() => testDb.cleanup());

async function startDemo(locale: "en" | "pt-BR" = "pt-BR") {
  const { ctx, setCookies } = createTestContext();
  const result = await appRouter
    .createCaller(ctx)
    .auth.startDemo({ locale, tzOffsetMinutes: 180 });
  const cookie = setCookies.find(c => c.name === COOKIE_NAME)!;
  const userId = (await verifySession(cookie.value))!;
  const user = (await getUserById(userId))!;
  return { result, cookie, user };
}

describe("auth.startDemo", () => {
  it("creates an isolated, seeded workspace with a 24h session", async () => {
    const { result, cookie, user } = await startDemo();

    expect(cookie.options).toMatchObject({
      maxAge: DEMO_SESSION_MAX_AGE_MS,
      httpOnly: true,
      sameSite: "lax",
    });
    expect(user.loginMethod).toBe("demo");
    expect(user.passwordHash).toBeNull();

    const caller = appRouter.createCaller(createTestContext(user).ctx);
    const projectList = await caller.projects.list();
    expect(projectList).toHaveLength(3);
    expect(projectList[0]?.id).toBe(result.projectId);
    expect(projectList[0]?.name).toBe("Lançamento do App Mobile");

    const board = await caller.tasks.listByProject({
      projectId: result.projectId,
    });
    expect(board.length).toBeGreaterThan(5);
    expect(new Set(board.map(t => t.status))).toEqual(
      new Set(["todo", "in_progress", "done"])
    );

    const metrics = await caller.dashboard.metrics();
    expect(metrics.total).toBe(18);
    expect(metrics.overdue).toBe(2);

    const members = await caller.tasks.members({ projectId: result.projectId });
    expect(members).toHaveLength(4);
  });

  it("keeps demo workspaces invisible to other users", async () => {
    const first = await startDemo("en");
    const second = await startDemo("en");
    const caller = appRouter.createCaller(createTestContext(second.user).ctx);
    await expect(
      caller.tasks.listByProject({ projectId: first.result.projectId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not let demo users invite real accounts", async () => {
    await appRouter
      .createCaller(createTestContext().ctx)
      .auth.register({
        name: "Real",
        email: "real@example.com",
        password: "password123",
      });
    const { result, user } = await startDemo();
    await expect(
      appRouter
        .createCaller(createTestContext(user).ctx)
        .projects.addMember({
          projectId: result.projectId,
          email: "real@example.com",
        })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("cleanup removes every expired demo row and keeps real users", async () => {
    await startDemo();
    await cleanupExpiredDemos(-1000);

    const { db } = testDb;
    expect(
      await db.select().from(users).where(eq(users.loginMethod, "demo")).all()
    ).toHaveLength(0);
    expect(await db.select().from(projects).all()).toHaveLength(0);
    expect(await db.select().from(tasks).all()).toHaveLength(0);
    expect(await db.select().from(comments).all()).toHaveLength(0);
    expect(await db.select().from(projectMembers).all()).toHaveLength(0);
    expect(await getUserByEmail("real@example.com")).not.toBeNull();
  });
});

describe("due dates", () => {
  const today = new Date(2026, 10, 9).getTime();

  it("treats a task as overdue only after its due day has ended", () => {
    const noonToday = today + DAY_MS / 2;
    expect(isTaskOverdue({ dueDate: today, status: "todo" }, noonToday)).toBe(
      false
    );
    expect(
      isTaskOverdue({ dueDate: today - DAY_MS, status: "todo" }, noonToday)
    ).toBe(true);
    expect(
      isTaskOverdue({ dueDate: today - DAY_MS, status: "done" }, noonToday)
    ).toBe(false);
    expect(isTaskOverdue({ dueDate: null, status: "todo" }, noonToday)).toBe(
      false
    );
  });

  it("round-trips date inputs in local time", () => {
    expect(fromDateInputValue("2026-11-09")).toBe(today);
    expect(toDateInputValue(today)).toBe("2026-11-09");
    expect(fromDateInputValue("")).toBeNull();
  });
});
