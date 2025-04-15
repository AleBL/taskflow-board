process.env.TURSO_DATABASE_URL = ":memory:";
delete process.env.TURSO_AUTH_TOKEN;

import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { setDb } from "./db";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

const _memClient = createClient({ url: ":memory:" });

beforeAll(async () => {
  await _memClient.execute(`
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
    )
  `);
  setDb(drizzle(_memClient));
});

const { appRouter } = await import("./routers");

type CookieCall = { name: string; value: string; options: Record<string, unknown> };
type ClearCall = { name: string; options: Record<string, unknown> };

function createPublicCtx() {
  const setCookies: CookieCall[] = [];
  const clearCookies: ClearCall[] = [];

  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies, clearCookies };
}

describe("auth.register", () => {
  it("registers a new user and sets a session cookie", async () => {
    const { ctx, setCookies } = createPublicCtx();
    const caller = appRouter.createCaller(ctx);

    const email = `test-${Date.now()}@example.com`;
    const result = await caller.auth.register({
      name: "Test User",
      email,
      password: "password123",
    });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe(email);
    expect(result.user.name).toBe("Test User");
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
    expect(typeof setCookies[0]?.value).toBe("string");
    expect(setCookies[0]?.value.length).toBeGreaterThan(10);
  });

  it("rejects duplicate email registration", async () => {
    const { ctx } = createPublicCtx();
    const caller = appRouter.createCaller(ctx);

    const email = `dup-${Date.now()}@example.com`;
    await caller.auth.register({ name: "First", email, password: "password123" });

    await expect(
      caller.auth.register({ name: "Second", email, password: "password456" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("auth.login", () => {
  it("logs in with correct credentials and sets a session cookie", async () => {
    const { ctx: regCtx } = createPublicCtx();
    const regCaller = appRouter.createCaller(regCtx);

    const email = `login-${Date.now()}@example.com`;
    await regCaller.auth.register({ name: "Login User", email, password: "securepass1" });

    const { ctx: loginCtx, setCookies } = createPublicCtx();
    const loginCaller = appRouter.createCaller(loginCtx);

    const result = await loginCaller.auth.login({ email, password: "securepass1" });

    expect(result.success).toBe(true);
    expect(result.user.email).toBe(email);
    expect(setCookies).toHaveLength(1);
    expect(setCookies[0]?.name).toBe(COOKIE_NAME);
  });

  it("rejects login with wrong password", async () => {
    const { ctx: regCtx } = createPublicCtx();
    const regCaller = appRouter.createCaller(regCtx);

    const email = `wrong-${Date.now()}@example.com`;
    await regCaller.auth.register({ name: "User", email, password: "correctpass" });

    const { ctx: loginCtx } = createPublicCtx();
    const loginCaller = appRouter.createCaller(loginCtx);

    await expect(
      loginCaller.auth.login({ email, password: "wrongpass" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects login for non-existent email", async () => {
    const { ctx } = createPublicCtx();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.auth.login({ email: "nobody@nowhere.com", password: "anything" })
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("auth.logout", () => {
  it("clears the session cookie", async () => {
    const { ctx, clearCookies } = createPublicCtx();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result.success).toBe(true);
    expect(clearCookies).toHaveLength(1);
    expect(clearCookies[0]?.name).toBe(COOKIE_NAME);
    expect(clearCookies[0]?.options).toMatchObject({ maxAge: -1 });
  });
});
