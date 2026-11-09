import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { User } from "../drizzle/schema";
import { getUserByEmail, isProjectMember } from "./db";
import { appRouter } from "./routers";
import { createTestContext, setupTestDb } from "./testDb";

let cleanup: () => void;
let alice: User;
let bob: User;
let projectId: number;
let taskId: number;

const asUser = (user: User | null) =>
  appRouter.createCaller(createTestContext(user).ctx);

async function registerUser(name: string, email: string) {
  await asUser(null).auth.register({ name, email, password: "password123" });
  return (await getUserByEmail(email))!;
}

beforeAll(async () => {
  ({ cleanup } = await setupTestDb());
  alice = await registerUser("Alice", "alice@example.com");
  bob = await registerUser("Bob", "bob@example.com");

  const project = await asUser(alice).projects.create({
    name: "Alice's project",
  });
  projectId = project.id;
  const task = await asUser(alice).tasks.create({
    projectId,
    title: "Secret task",
  });
  taskId = task.id;
});

afterAll(() => cleanup());

describe("authorization between users", () => {
  it("does not let a non-member read tasks, comments or members", async () => {
    const caller = asUser(bob);
    await expect(
      caller.tasks.listByProject({ projectId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.tasks.getById({ id: taskId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.tasks.members({ projectId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(caller.comments.listByTask({ taskId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("does not let a non-member change or delete tasks", async () => {
    const caller = asUser(bob);
    await expect(
      caller.tasks.update({ id: taskId, title: "hacked" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      caller.tasks.updateStatus({ id: taskId, status: "done" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(caller.tasks.delete({ id: taskId })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
    await expect(
      caller.comments.create({ taskId, content: "hi" })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const task = await asUser(alice).tasks.getById({ id: taskId });
    expect(task.title).toBe("Secret task");
  });

  it("blocks joining a project by assigning yourself a task in it", async () => {
    await expect(
      asUser(bob).tasks.create({
        projectId,
        title: "sneaky",
        assigneeId: bob.id,
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(await isProjectMember(projectId, bob.id)).toBe(false);
  });

  it("only allows assigning tasks to project members", async () => {
    await expect(
      asUser(alice).tasks.update({ id: taskId, assigneeId: bob.id })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("never sends the password hash to the client", async () => {
    const me = await asUser(alice).auth.me();
    expect(me).not.toBeNull();
    expect(me).not.toHaveProperty("passwordHash");
  });
});

describe("project members", () => {
  it("lets the owner invite by email, after which the member has access", async () => {
    await asUser(alice).projects.addMember({
      projectId,
      email: "bob@example.com",
    });
    expect(await isProjectMember(projectId, bob.id)).toBe(true);

    const tasks = await asUser(bob).tasks.listByProject({ projectId });
    expect(tasks.map(t => t.id)).toContain(taskId);

    await asUser(alice).tasks.update({ id: taskId, assigneeId: bob.id });
  });

  it("rejects duplicate invites and unknown emails", async () => {
    await expect(
      asUser(alice).projects.addMember({ projectId, email: "bob@example.com" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      asUser(alice).projects.addMember({
        projectId,
        email: "nobody@example.com",
      })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("does not let a regular member manage members", async () => {
    await expect(
      asUser(bob).projects.removeMember({ projectId, userId: alice.id })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("removing a member revokes access and unassigns their tasks", async () => {
    await asUser(alice).projects.removeMember({ projectId, userId: bob.id });
    await expect(
      asUser(bob).tasks.listByProject({ projectId })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });

    const task = await asUser(alice).tasks.getById({ id: taskId });
    expect(task.assigneeId).toBeNull();
  });
});

describe("rate limiting", () => {
  it("blocks the 6th registration from the same IP within an hour", async () => {
    const ip = "203.0.113.77";
    for (let i = 0; i < 5; i++) {
      await appRouter
        .createCaller(createTestContext(null, ip).ctx)
        .auth.register({
          name: "Spam",
          email: `spam-${i}@example.com`,
          password: "password123",
        });
    }
    await expect(
      appRouter
        .createCaller(createTestContext(null, ip).ctx)
        .auth.register({
          name: "Spam",
          email: "spam-6@example.com",
          password: "password123",
        })
    ).rejects.toMatchObject({ code: "TOO_MANY_REQUESTS" });
  });
});
