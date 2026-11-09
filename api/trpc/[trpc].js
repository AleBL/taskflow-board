// api/index.ts
import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import serverless from "serverless-http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

// server/routers.ts
import { z as z2 } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
var SESSION_MAX_AGE_MS = 1e3 * 60 * 60 * 24 * 30;
var DEMO_SESSION_MAX_AGE_MS = 1e3 * 60 * 60 * 24;
var DEMO_LOGIN_METHOD = "demo";
var UNAUTHED_ERR_MSG = "Please login (10001)";
var NOT_ADMIN_ERR_MSG = "You do not have required permission (10002)";

// server/_core/cookies.ts
function isSecureRequest(req) {
  if (req.protocol === "https") return true;
  const forwardedProto = req.headers?.["x-forwarded-proto"];
  if (!forwardedProto) return false;
  const protoList = Array.isArray(forwardedProto) ? forwardedProto : forwardedProto.split(",");
  return protoList.some((proto) => proto.trim().toLowerCase() === "https");
}
function getSessionCookieOptions(req) {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secure: isSecureRequest(req)
  };
}

// server/_core/systemRouter.ts
import { z } from "zod";

// server/_core/trpc.ts
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
var t = initTRPC.context().create({
  transformer: superjson
});
var router = t.router;
var tracingMiddleware = t.middleware(async (opts) => {
  const startedAt = Date.now();
  const requestId = opts.ctx.res?.locals?.requestId ?? "n/a";
  const path = opts.path ?? "unknown";
  console.log(
    `[TRPC] -> id=${requestId} type=${opts.type} path=${path}`
  );
  try {
    const result = await opts.next();
    console.log(
      `[TRPC] <- id=${requestId} type=${opts.type} path=${path} ok ms=${Date.now() - startedAt}`
    );
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_trpc_error";
    console.error(
      `[TRPC] <- id=${requestId} type=${opts.type} path=${path} error=${message} ms=${Date.now() - startedAt}`
    );
    throw error;
  }
});
var publicProcedure = t.procedure.use(tracingMiddleware);
var requireUser = t.middleware(async (opts) => {
  const { ctx, next } = opts;
  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user
    }
  });
});
var protectedProcedure = t.procedure.use(tracingMiddleware).use(requireUser);
var adminProcedure = t.procedure.use(tracingMiddleware).use(
  t.middleware(async (opts) => {
    const { ctx, next } = opts;
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({
      ctx: {
        ...ctx,
        user: ctx.user
      }
    });
  })
);

// server/_core/systemRouter.ts
var systemRouter = router({
  health: publicProcedure.input(
    z.object({
      timestamp: z.number().min(0, "timestamp cannot be negative")
    })
  ).query(() => ({
    ok: true
  }))
});

// server/routers.ts
import { TRPCError as TRPCError4 } from "@trpc/server";

// server/db.ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, and, like, desc, asc, inArray, lte, ne, isNotNull } from "drizzle-orm";

// drizzle/schema.ts
import {
  index,
  integer,
  sqliteTable,
  text,
  real,
  uniqueIndex
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
var users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email").unique(),
  passwordHash: text("passwordHash"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).notNull().default("user"),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
});
var projects = sqliteTable("projects", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").notNull().default("#6366f1"),
  ownerId: integer("ownerId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
});
var tasks = sqliteTable("tasks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status", { enum: ["todo", "in_progress", "done"] }).notNull().default("todo"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  dueDate: integer("dueDate", { mode: "timestamp_ms" }),
  completedAt: integer("completedAt", { mode: "timestamp_ms" }),
  position: real("position").notNull().default(0),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  assigneeId: integer("assigneeId").references(() => users.id, {
    onDelete: "set null"
  }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
}, (table) => [
  index("tasks_project_status_position_idx").on(
    table.projectId,
    table.status,
    table.position
  ),
  index("tasks_assignee_idx").on(table.assigneeId)
]);
var projectMembers = sqliteTable("project_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  joinedAt: integer("joinedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
}, (table) => [
  uniqueIndex("project_members_project_user_unique").on(
    table.projectId,
    table.userId
  ),
  index("project_members_user_idx").on(table.userId)
]);
var comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  taskId: integer("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: integer("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
}, (table) => [index("comments_task_idx").on(table.taskId)]);
var rateLimits = sqliteTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  windowStart: integer("windowStart").notNull()
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  ownerOpenId: "",
  isProduction: process.env.NODE_ENV === "production" || process.env.VERCEL === "1"
};

// shared/dates.ts
var DAY_MS = 24 * 60 * 60 * 1e3;
function isTaskOverdue(task, now = Date.now()) {
  if (!task.dueDate || task.status === "done") return false;
  return new Date(task.dueDate).getTime() + DAY_MS <= now;
}

// server/db.ts
var _db = null;
function getDb() {
  if (_db) return _db;
  const url = ENV.databaseUrl.trim() || ":memory:";
  const authToken = ENV.tursoAuthToken.trim();
  const client = createClient(
    url === ":memory:" ? { url: ":memory:" } : { url, authToken }
  );
  _db = drizzle(client);
  return _db;
}
async function getUserById(id) {
  const db = getDb();
  return await db.select().from(users).where(eq(users.id, id)).get() ?? null;
}
async function getUserByEmail(email) {
  const db = getDb();
  return await db.select().from(users).where(eq(users.email, email)).get() ?? null;
}
async function updateUser(id, data) {
  const db = getDb();
  const result = await db.update(users).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, id)).returning();
  return result[0] ?? null;
}
async function createLocalUser(data) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const openId = `local:${data.email}`;
  const result = await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "local",
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now
  }).returning();
  return result[0];
}
async function getProjectMembersList(projectId) {
  const db = getDb();
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: projectMembers.role,
    joinedAt: projectMembers.joinedAt
  }).from(projectMembers).innerJoin(users, eq(projectMembers.userId, users.id)).where(eq(projectMembers.projectId, projectId)).orderBy(asc(projectMembers.joinedAt)).all();
}
async function isProjectMember(projectId, userId) {
  const db = getDb();
  const row = await db.select({ id: projectMembers.id }).from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).get();
  return row !== void 0;
}
async function addProjectMember(projectId, userId, role = "member") {
  const db = getDb();
  await db.insert(projectMembers).values({ projectId, userId, role, joinedAt: /* @__PURE__ */ new Date() }).onConflictDoNothing();
}
async function removeProjectMember(projectId, userId) {
  const db = getDb();
  await db.update(tasks).set({ assigneeId: null, updatedAt: /* @__PURE__ */ new Date() }).where(and(eq(tasks.projectId, projectId), eq(tasks.assigneeId, userId)));
  const result = await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).returning();
  return result[0] ?? null;
}
async function getAccessibleProjectIds(userId) {
  const db = getDb();
  const rows = await db.select({ projectId: projectMembers.projectId }).from(projectMembers).where(eq(projectMembers.userId, userId)).all();
  return rows.map((r) => r.projectId);
}
async function getProjectsByUser(userId) {
  const db = getDb();
  const accessibleIds = await getAccessibleProjectIds(userId);
  if (accessibleIds.length === 0) return [];
  return db.select().from(projects).where(inArray(projects.id, accessibleIds)).orderBy(desc(projects.createdAt)).all();
}
async function getProjectById(id, userId) {
  const db = getDb();
  const isMember = await isProjectMember(id, userId);
  if (!isMember) return null;
  return await db.select().from(projects).where(eq(projects.id, id)).get() ?? null;
}
async function createProject(data) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const result = await db.insert(projects).values({ ...data, createdAt: now, updatedAt: now }).returning();
  const project = result[0];
  await addProjectMember(project.id, data.ownerId, "owner");
  return project;
}
async function updateProject(id, userId, data) {
  const db = getDb();
  const project = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.ownerId, userId))).get();
  if (!project) return null;
  const result = await db.update(projects).set({ ...data, updatedAt: /* @__PURE__ */ new Date() }).where(eq(projects.id, id)).returning();
  return result[0] ?? null;
}
async function deleteProject(id, userId) {
  const db = getDb();
  const result = await db.delete(projects).where(and(eq(projects.id, id), eq(projects.ownerId, userId))).returning();
  return result[0] ?? null;
}
async function getTasksByProject(projectId) {
  const db = getDb();
  return db.select().from(tasks).where(eq(tasks.projectId, projectId)).orderBy(asc(tasks.position), asc(tasks.createdAt)).all();
}
async function getTaskById(id) {
  const db = getDb();
  return await db.select().from(tasks).where(eq(tasks.id, id)).get() ?? null;
}
async function searchTasks(params) {
  const db = getDb();
  const accessibleIds = await getAccessibleProjectIds(params.userId);
  if (accessibleIds.length === 0) return [];
  const conditions = [
    params.search ? like(tasks.title, `%${params.search}%`) : void 0,
    params.status ? eq(tasks.status, params.status) : void 0,
    params.priority ? eq(tasks.priority, params.priority) : void 0,
    params.projectId ? eq(tasks.projectId, params.projectId) : void 0,
    params.overdue ? ne(tasks.status, "done") : void 0,
    params.overdue ? isNotNull(tasks.dueDate) : void 0,
    params.overdue ? lte(tasks.dueDate, new Date(Date.now() - DAY_MS)) : void 0,
    inArray(tasks.projectId, accessibleIds)
  ].filter(Boolean);
  return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.createdAt)).all();
}
async function createTask(data) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const existing = await db.select({ position: tasks.position }).from(tasks).where(
    and(eq(tasks.projectId, data.projectId), eq(tasks.status, data.status))
  ).orderBy(desc(tasks.position)).get();
  const position = existing ? existing.position + 1 : 0;
  const result = await db.insert(tasks).values({ ...data, position, createdAt: now, updatedAt: now }).returning();
  return result[0];
}
async function updateTask(id, data) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const updateData = { updatedAt: now };
  if (data.title !== void 0) updateData.title = data.title;
  if (data.description !== void 0) updateData.description = data.description;
  if (data.status !== void 0) {
    updateData.status = data.status;
    updateData.completedAt = data.status === "done" ? now : null;
  }
  if (data.priority !== void 0) updateData.priority = data.priority;
  if (data.dueDate !== void 0) updateData.dueDate = data.dueDate;
  if (data.position !== void 0) updateData.position = data.position;
  if ("assigneeId" in data) updateData.assigneeId = data.assigneeId ?? null;
  const result = await db.update(tasks).set(updateData).where(eq(tasks.id, id)).returning();
  return result[0] ?? null;
}
async function deleteTask(id) {
  const db = getDb();
  const result = await db.delete(tasks).where(eq(tasks.id, id)).returning();
  return result[0] ?? null;
}
async function getCommentsByTask(taskId) {
  const db = getDb();
  return db.select({
    id: comments.id,
    content: comments.content,
    taskId: comments.taskId,
    authorId: comments.authorId,
    authorName: users.name,
    createdAt: comments.createdAt,
    updatedAt: comments.updatedAt
  }).from(comments).leftJoin(users, eq(comments.authorId, users.id)).where(eq(comments.taskId, taskId)).orderBy(asc(comments.createdAt)).all();
}
async function createComment(data) {
  const db = getDb();
  const now = /* @__PURE__ */ new Date();
  const result = await db.insert(comments).values({ ...data, createdAt: now, updatedAt: now }).returning();
  return result[0];
}
async function deleteComment(id, authorId) {
  const db = getDb();
  const result = await db.delete(comments).where(and(eq(comments.id, id), eq(comments.authorId, authorId))).returning();
  return result[0] ?? null;
}
async function getDashboardMetrics(userId) {
  const db = getDb();
  const accessibleIds = await getAccessibleProjectIds(userId);
  const totalProjects = accessibleIds.length;
  if (totalProjects === 0) {
    return { totalProjects: 0, total: 0, todo: 0, inProgress: 0, done: 0, overdue: 0 };
  }
  const allTasks = await db.select({
    id: tasks.id,
    status: tasks.status,
    dueDate: tasks.dueDate,
    projectId: tasks.projectId
  }).from(tasks).where(inArray(tasks.projectId, accessibleIds)).all();
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

// server/auth.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
var BCRYPT_ROUNDS = 12;
var DEV_ONLY_SECRET = "dev-only-secret-not-for-production";
var warnedAboutDevSecret = false;
function getSecretKey() {
  const secret = ENV.cookieSecret;
  if (!secret) {
    if (ENV.isProduction) {
      throw new Error("JWT_SECRET must be set in production");
    }
    if (!warnedAboutDevSecret) {
      warnedAboutDevSecret = true;
      console.warn("[Auth] JWT_SECRET not set, using an insecure development secret");
    }
    return new TextEncoder().encode(DEV_ONLY_SECRET);
  }
  return new TextEncoder().encode(secret);
}
async function signSession(userId, maxAgeMs) {
  return new SignJWT({ sub: String(userId) }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime(Math.floor((Date.now() + maxAgeMs) / 1e3)).sign(getSecretKey());
}
async function verifySession(token) {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      algorithms: ["HS256"]
    });
    const id = parseInt(String(payload.sub), 10);
    return isNaN(id) ? null : id;
  } catch {
    return null;
  }
}
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}
async function authenticateRequest(req) {
  const raw = req.headers?.cookie ?? "";
  const cookies = Object.fromEntries(
    raw.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k?.trim() ?? "", v.join("=")];
    })
  );
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  const userId = await verifySession(token);
  if (!userId) return null;
  return getUserById(userId);
}
function toPublicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    loginMethod: user.loginMethod,
    createdAt: user.createdAt
  };
}

// server/access.ts
import { TRPCError as TRPCError2 } from "@trpc/server";
import { eq as eq2 } from "drizzle-orm";
async function assertProjectMember(projectId, userId) {
  if (!await isProjectMember(projectId, userId)) {
    throw new TRPCError2({ code: "NOT_FOUND", message: "Project not found" });
  }
}
async function assertProjectOwner(projectId, userId) {
  const db = getDb();
  const project = await db.select({ id: projects.id, ownerId: projects.ownerId }).from(projects).where(eq2(projects.id, projectId)).get();
  if (!project || !await isProjectMember(projectId, userId)) {
    throw new TRPCError2({ code: "NOT_FOUND", message: "Project not found" });
  }
  if (project.ownerId !== userId) {
    throw new TRPCError2({ code: "FORBIDDEN", message: "Only the project owner can do this" });
  }
  return project;
}
async function getAccessibleTask(taskId, userId) {
  const task = await getTaskById(taskId);
  if (!task || !await isProjectMember(task.projectId, userId)) {
    throw new TRPCError2({ code: "NOT_FOUND", message: "Task not found" });
  }
  return task;
}
async function assertAssigneeIsMember(projectId, assigneeId) {
  if (!assigneeId) return;
  if (!await isProjectMember(projectId, assigneeId)) {
    throw new TRPCError2({
      code: "BAD_REQUEST",
      message: "Assignee must be a member of the project"
    });
  }
}

// server/rateLimit.ts
import { TRPCError as TRPCError3 } from "@trpc/server";
import { lt, sql as sql2 } from "drizzle-orm";
var RATE_LIMITS = {
  login: { limit: 10, windowMs: 15 * 60 * 1e3 },
  register: { limit: 5, windowMs: 60 * 60 * 1e3 },
  demo: { limit: 10, windowMs: 60 * 60 * 1e3 }
};
function getClientIp(req) {
  const forwarded = req?.headers?.["x-forwarded-for"];
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0];
  if (first?.trim()) return first.trim();
  const realIp = req?.headers?.["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) return realIp.trim();
  return req?.socket?.remoteAddress ?? "unknown";
}
async function enforceRateLimit(name, req) {
  const { limit, windowMs } = RATE_LIMITS[name];
  const key = `${name}:${getClientIp(req)}`;
  const now = Date.now();
  const windowExpiredBefore = now - windowMs;
  let count;
  try {
    const db = getDb();
    const rows = await db.insert(rateLimits).values({ key, count: 1, windowStart: now }).onConflictDoUpdate({
      target: rateLimits.key,
      set: {
        count: sql2`CASE WHEN ${rateLimits.windowStart} < ${windowExpiredBefore} THEN 1 ELSE ${rateLimits.count} + 1 END`,
        windowStart: sql2`CASE WHEN ${rateLimits.windowStart} < ${windowExpiredBefore} THEN ${now} ELSE ${rateLimits.windowStart} END`
      }
    }).returning({ count: rateLimits.count });
    count = rows[0]?.count ?? 1;
  } catch (error) {
    console.warn("[RateLimit] skipped:", String(error));
    return;
  }
  if (count > limit) {
    throw new TRPCError3({
      code: "TOO_MANY_REQUESTS",
      message: "Too many attempts, please try again later"
    });
  }
}
async function purgeStaleRateLimits(olderThanMs = 24 * 60 * 60 * 1e3) {
  const db = getDb();
  await db.delete(rateLimits).where(lt(rateLimits.windowStart, Date.now() - olderThanMs));
}

// server/demo.ts
import { and as and2, eq as eq3, inArray as inArray2, lt as lt2, or } from "drizzle-orm";
import { nanoid } from "nanoid";
var PEOPLE = {
  pt: ["Visitante", "Ana Souza", "Bruno Lima", "Carla Mendes"],
  en: ["Guest", "Alex Morgan", "Sam Rivera", "Jordan Lee"]
};
var DEMO_PROJECTS = [
  {
    name: { pt: "Lan\xE7amento do App Mobile", en: "Mobile App Launch" },
    description: {
      pt: "Vers\xE3o 1.0 do app iOS e Android, com login social e notifica\xE7\xF5es push.",
      en: "Version 1.0 of the iOS and Android app, with social login and push notifications."
    },
    color: "#6366f1",
    tasks: [
      {
        title: { pt: "Corrigir crash ao abrir a c\xE2mera no Android 14", en: "Fix camera crash on Android 14" },
        description: {
          pt: "Acontece ao anexar foto no perfil. Afeta cerca de 8% das sess\xF5es no beta.",
          en: "Happens when attaching a profile photo. Affects about 8% of beta sessions."
        },
        status: "in_progress",
        priority: "high",
        dueInDays: -1,
        assignee: 2,
        comments: [
          {
            author: 2,
            text: {
              pt: "Reproduzi no Pixel 8. \xC9 a nova permiss\xE3o de m\xEDdia do Android 14.",
              en: "Reproduced on a Pixel 8. It's the new Android 14 media permission."
            },
            hoursAgo: 20
          },
          {
            author: 1,
            text: {
              pt: "Boa! Consegue subir o fix antes da build de sexta?",
              en: "Nice! Can you ship the fix before Friday's build?"
            },
            hoursAgo: 18
          }
        ]
      },
      {
        title: { pt: "Login com Google e Apple", en: "Sign in with Google and Apple" },
        description: {
          pt: "OAuth nativo em cada plataforma e valida\xE7\xE3o do token no backend.",
          en: "Native OAuth on each platform and token validation on the backend."
        },
        status: "in_progress",
        priority: "high",
        dueInDays: 2,
        assignee: 0,
        comments: [
          {
            author: 1,
            text: {
              pt: "A Apple exige o bot\xE3o pr\xF3prio quando h\xE1 outro login social. J\xE1 est\xE1 no layout.",
              en: "Apple requires its own button when another social login exists. It's in the layout."
            },
            hoursAgo: 6
          }
        ]
      },
      {
        title: { pt: "Notifica\xE7\xF5es push de lembrete", en: "Reminder push notifications" },
        status: "todo",
        priority: "medium",
        dueInDays: 5,
        assignee: 3
      },
      {
        title: { pt: "Textos e screenshots da App Store", en: "App Store copy and screenshots" },
        status: "todo",
        priority: "low",
        dueInDays: 9,
        assignee: 1
      },
      {
        title: { pt: "Teste de usabilidade com 5 usu\xE1rios", en: "Usability test with 5 users" },
        status: "todo",
        priority: "medium",
        dueInDays: null,
        assignee: 0
      },
      {
        title: { pt: "Pipeline de CI/CD com deploy na loja", en: "CI/CD pipeline with store deploys" },
        status: "done",
        priority: "high",
        dueInDays: -6,
        assignee: 2
      },
      {
        title: { pt: "\xCDcone e splash screen", en: "App icon and splash screen" },
        status: "done",
        priority: "medium",
        dueInDays: -10,
        assignee: 1
      }
    ]
  },
  {
    name: { pt: "Redesign do Site", en: "Website Redesign" },
    description: {
      pt: "Novo site institucional focado em convers\xE3o e performance.",
      en: "New marketing site focused on conversion and performance."
    },
    color: "#ec4899",
    tasks: [
      {
        title: { pt: "Revisar SEO das p\xE1ginas principais", en: "SEO review of key pages" },
        description: {
          pt: "T\xEDtulos, meta descriptions e dados estruturados.",
          en: "Titles, meta descriptions and structured data."
        },
        status: "todo",
        priority: "medium",
        dueInDays: -2,
        assignee: 0
      },
      {
        title: { pt: "P\xE1gina de pre\xE7os", en: "Pricing page" },
        status: "in_progress",
        priority: "high",
        dueInDays: 1,
        assignee: 0,
        comments: [
          {
            author: 3,
            text: {
              pt: "Podemos destacar o plano anual com 2 meses gr\xE1tis?",
              en: "Can we highlight the yearly plan with 2 months free?"
            },
            hoursAgo: 3
          }
        ]
      },
      {
        title: { pt: "Otimizar imagens e Core Web Vitals", en: "Optimize images and Core Web Vitals" },
        status: "todo",
        priority: "medium",
        dueInDays: 6,
        assignee: 2
      },
      {
        title: { pt: "Migrar o blog para o novo layout", en: "Move the blog to the new layout" },
        status: "todo",
        priority: "low",
        dueInDays: 14,
        assignee: 3
      },
      {
        title: { pt: "Design system: cores, tipografia e componentes", en: "Design system: colors, type and components" },
        status: "done",
        priority: "high",
        dueInDays: -4,
        assignee: 1
      },
      {
        title: { pt: "Wireframes da nova home", en: "New homepage wireframes" },
        status: "done",
        priority: "medium",
        dueInDays: -8,
        assignee: 1
      }
    ]
  },
  {
    name: { pt: "Onboarding de Clientes", en: "Customer Onboarding" },
    description: {
      pt: "Fluxo de boas-vindas, tutoriais e base de conhecimento.",
      en: "Welcome flow, tutorials and knowledge base."
    },
    color: "#22c55e",
    tasks: [
      {
        title: { pt: "E-mail de boas-vindas com checklist", en: "Welcome email with checklist" },
        status: "in_progress",
        priority: "medium",
        dueInDays: 0,
        assignee: 3,
        comments: [
          {
            author: 1,
            text: {
              pt: "Mandei a vers\xE3o final do texto no Drive, falta s\xF3 o HTML.",
              en: "Final copy is in the Drive, only the HTML is missing."
            },
            hoursAgo: 2
          }
        ]
      },
      {
        title: { pt: "Central de ajuda com 10 artigos", en: "Help center with 10 articles" },
        status: "todo",
        priority: "high",
        dueInDays: 4,
        assignee: 2
      },
      {
        title: { pt: "V\xEDdeos tutoriais curtos", en: "Short tutorial videos" },
        status: "todo",
        priority: "low",
        dueInDays: 10,
        assignee: 1
      },
      {
        title: { pt: "Pesquisa NPS ap\xF3s 30 dias", en: "NPS survey after 30 days" },
        status: "todo",
        priority: "low",
        dueInDays: null,
        assignee: null
      },
      {
        title: { pt: "Mapear a jornada do novo cliente", en: "Map the new customer journey" },
        status: "done",
        priority: "medium",
        dueInDays: -12,
        assignee: 3
      }
    ]
  }
];
function startOfVisitorDay(now, tzOffsetMinutes) {
  const offsetMs = tzOffsetMinutes * 6e4;
  return Math.floor((now - offsetMs) / DAY_MS) * DAY_MS + offsetMs;
}
async function createDemoWorkspace(options) {
  const lang = options.locale === "pt-BR" ? "pt" : "en";
  const db = getDb();
  const demoId = nanoid(12);
  const now = /* @__PURE__ */ new Date();
  const today = startOfVisitorDay(now.getTime(), options.tzOffsetMinutes);
  const peopleRows = PEOPLE[lang].map((name, i) => ({
    openId: i === 0 ? `demo:${demoId}` : `demo:${demoId}:${i}`,
    name,
    email: i === 0 ? `demo-${demoId}@demo.taskflow.invalid` : `demo-${demoId}-${i}@demo.taskflow.invalid`,
    loginMethod: DEMO_LOGIN_METHOD,
    role: "user",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now
  }));
  const insertedUsers = await db.insert(users).values(peopleRows).returning({ id: users.id, openId: users.openId });
  const userIdByOpenId = new Map(insertedUsers.map((u) => [u.openId, u.id]));
  const personIds = peopleRows.map((p) => userIdByOpenId.get(p.openId));
  const visitorId = personIds[0];
  const insertedProjects = await db.insert(projects).values(
    DEMO_PROJECTS.map((p, i) => ({
      name: p.name[lang],
      description: p.description[lang],
      color: p.color,
      ownerId: visitorId,
      createdAt: new Date(now.getTime() - i * 6e4),
      updatedAt: now
    }))
  ).returning({ id: projects.id, name: projects.name });
  const projectIdByName = new Map(insertedProjects.map((p) => [p.name, p.id]));
  const projectIds = DEMO_PROJECTS.map((p) => projectIdByName.get(p.name[lang]));
  await db.insert(projectMembers).values(
    projectIds.flatMap(
      (projectId) => personIds.map((userId, i) => ({
        projectId,
        userId,
        role: i === 0 ? "owner" : "member",
        joinedAt: now
      }))
    )
  );
  const taskRows = DEMO_PROJECTS.flatMap((project, projectIndex) => {
    const positions = { todo: 0, in_progress: 0, done: 0 };
    return project.tasks.map((task) => {
      const dueDate = task.dueInDays === null ? null : new Date(today + task.dueInDays * DAY_MS);
      return {
        title: task.title[lang],
        description: task.description?.[lang] ?? null,
        status: task.status,
        priority: task.priority,
        dueDate,
        completedAt: task.status === "done" ? dueDate ?? now : null,
        position: positions[task.status]++,
        projectId: projectIds[projectIndex],
        assigneeId: task.assignee === null ? null : personIds[task.assignee],
        createdAt: now,
        updatedAt: now
      };
    });
  });
  const insertedTasks = await db.insert(tasks).values(taskRows).returning({ id: tasks.id, title: tasks.title });
  const taskIdByTitle = new Map(insertedTasks.map((t2) => [t2.title, t2.id]));
  const commentRows = DEMO_PROJECTS.flatMap(
    (project) => project.tasks.flatMap(
      (task) => (task.comments ?? []).map((c) => {
        const createdAt = new Date(now.getTime() - c.hoursAgo * 60 * 60 * 1e3);
        return {
          taskId: taskIdByTitle.get(task.title[lang]),
          authorId: personIds[c.author],
          content: c.text[lang],
          createdAt,
          updatedAt: createdAt
        };
      })
    )
  );
  if (commentRows.length > 0) {
    await db.insert(comments).values(commentRows);
  }
  return { userId: visitorId, projectId: projectIds[0] };
}
async function cleanupExpiredDemos(maxAgeMs = DEMO_SESSION_MAX_AGE_MS) {
  const db = getDb();
  const cutoff = new Date(Date.now() - maxAgeMs);
  const isExpiredDemoUser = and2(
    eq3(users.loginMethod, DEMO_LOGIN_METHOD),
    lt2(users.createdAt, cutoff)
  );
  const expiredUsers = db.select({ id: users.id }).from(users).where(isExpiredDemoUser);
  const demoProjects = db.select({ id: projects.id }).from(projects).where(inArray2(projects.ownerId, expiredUsers));
  const demoTasks = db.select({ id: tasks.id }).from(tasks).where(inArray2(tasks.projectId, demoProjects));
  await db.batch([
    db.delete(comments).where(or(inArray2(comments.taskId, demoTasks), inArray2(comments.authorId, expiredUsers))),
    db.delete(tasks).where(inArray2(tasks.projectId, demoProjects)),
    db.update(tasks).set({ assigneeId: null }).where(inArray2(tasks.assigneeId, expiredUsers)),
    db.delete(projectMembers).where(
      or(
        inArray2(projectMembers.projectId, demoProjects),
        inArray2(projectMembers.userId, expiredUsers)
      )
    ),
    db.delete(projects).where(inArray2(projects.ownerId, expiredUsers)),
    db.delete(users).where(isExpiredDemoUser)
  ]);
  await purgeStaleRateLimits();
}

// server/routers.ts
async function withTimeout(promise, ms, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function setSessionCookie(ctx, userId, maxAgeMs) {
  const token = await signSession(userId, maxAgeMs);
  const res = ctx.res;
  res?.cookie?.(COOKIE_NAME, token, {
    ...getSessionCookieOptions(ctx.req),
    maxAge: maxAgeMs
  });
}
function isDemoUser(user) {
  return user.loginMethod === DEMO_LOGIN_METHOD;
}
var projectsRouter = router({
  list: protectedProcedure.query(
    ({ ctx }) => getProjectsByUser(ctx.user.id)
  ),
  getById: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.id, ctx.user.id);
    if (!project) throw new TRPCError4({ code: "NOT_FOUND", message: "Project not found" });
    return project;
  }),
  create: protectedProcedure.input(
    z2.object({
      name: z2.string().min(1).max(100),
      description: z2.string().max(500).optional(),
      color: z2.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
    })
  ).mutation(
    ({ ctx, input }) => createProject({
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "#6366f1",
      ownerId: ctx.user.id
    })
  ),
  update: protectedProcedure.input(
    z2.object({
      id: z2.number().int().positive(),
      name: z2.string().min(1).max(100).optional(),
      description: z2.string().max(500).optional().nullable(),
      color: z2.string().regex(/^#[0-9a-fA-F]{6}$/).optional()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, ...data } = input;
    const project = await updateProject(id, ctx.user.id, data);
    if (!project) throw new TRPCError4({ code: "NOT_FOUND", message: "Project not found" });
    return project;
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const deleted = await deleteProject(input.id, ctx.user.id);
    if (!deleted) throw new TRPCError4({ code: "NOT_FOUND", message: "Project not found" });
    return { success: true };
  }),
  addMember: protectedProcedure.input(
    z2.object({
      projectId: z2.number().int().positive(),
      email: z2.string().email()
    })
  ).mutation(async ({ ctx, input }) => {
    if (isDemoUser(ctx.user)) {
      throw new TRPCError4({
        code: "FORBIDDEN",
        message: "Inviting members is not available in demo mode"
      });
    }
    await assertProjectOwner(input.projectId, ctx.user.id);
    const invitee = await getUserByEmail(input.email.trim());
    if (!invitee || isDemoUser(invitee)) {
      throw new TRPCError4({ code: "NOT_FOUND", message: "User not found" });
    }
    const members = await getProjectMembersList(input.projectId);
    if (members.some((m) => m.id === invitee.id)) {
      throw new TRPCError4({ code: "CONFLICT", message: "User is already a member" });
    }
    await addProjectMember(input.projectId, invitee.id, "member");
    return { success: true };
  }),
  removeMember: protectedProcedure.input(
    z2.object({
      projectId: z2.number().int().positive(),
      userId: z2.number().int().positive()
    })
  ).mutation(async ({ ctx, input }) => {
    const project = await assertProjectOwner(input.projectId, ctx.user.id);
    if (input.userId === project.ownerId) {
      throw new TRPCError4({ code: "BAD_REQUEST", message: "The owner cannot be removed" });
    }
    const removed = await removeProjectMember(input.projectId, input.userId);
    if (!removed) throw new TRPCError4({ code: "NOT_FOUND", message: "Member not found" });
    return { success: true };
  })
});
var tasksRouter = router({
  listByProject: protectedProcedure.input(z2.object({ projectId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertProjectMember(input.projectId, ctx.user.id);
    return getTasksByProject(input.projectId);
  }),
  search: protectedProcedure.input(
    z2.object({
      search: z2.string().optional(),
      status: z2.enum(["todo", "in_progress", "done"]).optional(),
      priority: z2.enum(["low", "medium", "high"]).optional(),
      projectId: z2.number().int().positive().optional(),
      overdue: z2.boolean().optional()
    })
  ).query(
    ({ ctx, input }) => searchTasks({ userId: ctx.user.id, ...input })
  ),
  getById: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(({ ctx, input }) => getAccessibleTask(input.id, ctx.user.id)),
  members: protectedProcedure.input(z2.object({ projectId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await assertProjectMember(input.projectId, ctx.user.id);
    return getProjectMembersList(input.projectId);
  }),
  create: protectedProcedure.input(
    z2.object({
      title: z2.string().min(1).max(200),
      description: z2.string().max(2e3).optional(),
      status: z2.enum(["todo", "in_progress", "done"]).optional(),
      priority: z2.enum(["low", "medium", "high"]).optional(),
      dueDate: z2.number().optional().nullable(),
      projectId: z2.number().int().positive(),
      assigneeId: z2.number().int().positive().optional().nullable()
    })
  ).mutation(async ({ ctx, input }) => {
    await assertProjectMember(input.projectId, ctx.user.id);
    await assertAssigneeIsMember(input.projectId, input.assigneeId);
    return createTask({
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      projectId: input.projectId,
      assigneeId: input.assigneeId ?? null
    });
  }),
  update: protectedProcedure.input(
    z2.object({
      id: z2.number().int().positive(),
      title: z2.string().min(1).max(200).optional(),
      description: z2.string().max(2e3).optional().nullable(),
      status: z2.enum(["todo", "in_progress", "done"]).optional(),
      priority: z2.enum(["low", "medium", "high"]).optional(),
      dueDate: z2.number().optional().nullable(),
      position: z2.number().optional(),
      assigneeId: z2.number().int().positive().optional().nullable()
    })
  ).mutation(async ({ ctx, input }) => {
    const { id, dueDate, ...rest } = input;
    const existing = await getAccessibleTask(id, ctx.user.id);
    await assertAssigneeIsMember(existing.projectId, rest.assigneeId);
    const task = await updateTask(id, {
      ...rest,
      dueDate: dueDate !== void 0 ? dueDate ? new Date(dueDate) : null : void 0
    });
    if (!task) throw new TRPCError4({ code: "NOT_FOUND", message: "Task not found" });
    return task;
  }),
  updateStatus: protectedProcedure.input(
    z2.object({
      id: z2.number().int().positive(),
      status: z2.enum(["todo", "in_progress", "done"]),
      position: z2.number().optional()
    })
  ).mutation(async ({ ctx, input }) => {
    await getAccessibleTask(input.id, ctx.user.id);
    const task = await updateTask(input.id, {
      status: input.status,
      position: input.position
    });
    if (!task) throw new TRPCError4({ code: "NOT_FOUND", message: "Task not found" });
    return task;
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    await getAccessibleTask(input.id, ctx.user.id);
    const deleted = await deleteTask(input.id);
    if (!deleted) throw new TRPCError4({ code: "NOT_FOUND", message: "Task not found" });
    return { success: true };
  })
});
var commentsRouter = router({
  listByTask: protectedProcedure.input(z2.object({ taskId: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    await getAccessibleTask(input.taskId, ctx.user.id);
    return getCommentsByTask(input.taskId);
  }),
  create: protectedProcedure.input(
    z2.object({
      taskId: z2.number().int().positive(),
      content: z2.string().min(1).max(2e3)
    })
  ).mutation(async ({ ctx, input }) => {
    await getAccessibleTask(input.taskId, ctx.user.id);
    return createComment({
      taskId: input.taskId,
      content: input.content,
      authorId: ctx.user.id
    });
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const deleted = await deleteComment(input.id, ctx.user.id);
    if (!deleted) throw new TRPCError4({ code: "NOT_FOUND", message: "Comment not found" });
    return { success: true };
  })
});
var dashboardRouter = router({
  metrics: protectedProcedure.query(
    ({ ctx }) => getDashboardMetrics(ctx.user.id)
  )
});
var appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(({ ctx }) => ctx.user ? toPublicUser(ctx.user) : null),
    startDemo: publicProcedure.input(
      z2.object({
        locale: z2.enum(["en", "pt-BR"]),
        tzOffsetMinutes: z2.number().int().min(-840).max(840)
      })
    ).mutation(async ({ ctx, input }) => {
      await enforceRateLimit("demo", ctx.req);
      try {
        await cleanupExpiredDemos();
      } catch (error) {
        console.warn("[Demo] cleanup skipped:", String(error));
      }
      const { userId, projectId } = await withTimeout(
        createDemoWorkspace(input),
        8e3,
        "DEMO_CREATE"
      );
      await setSessionCookie(ctx, userId, DEMO_SESSION_MAX_AGE_MS);
      return { success: true, projectId };
    }),
    register: publicProcedure.input(
      z2.object({
        name: z2.string().min(2).max(100),
        email: z2.string().email(),
        password: z2.string().min(8).max(128)
      })
    ).mutation(async ({ input, ctx }) => {
      await enforceRateLimit("register", ctx.req);
      const existing = await withTimeout(
        getUserByEmail(input.email),
        4e3,
        "REGISTER_GET_USER"
      );
      if (existing) {
        throw new TRPCError4({
          code: "CONFLICT",
          message: "Email already in use"
        });
      }
      const passwordHash = await hashPassword(input.password);
      const user = await withTimeout(
        createLocalUser({
          name: input.name,
          email: input.email,
          passwordHash
        }),
        4e3,
        "REGISTER_CREATE_USER"
      );
      await setSessionCookie(ctx, user.id, SESSION_MAX_AGE_MS);
      return { success: true, user: toPublicUser(user) };
    }),
    login: publicProcedure.input(
      z2.object({
        email: z2.string().email(),
        password: z2.string().min(1)
      })
    ).mutation(async ({ input, ctx }) => {
      await enforceRateLimit("login", ctx.req);
      const user = await withTimeout(
        getUserByEmail(input.email),
        4e3,
        "LOGIN_GET_USER"
      );
      if (!user || !user.passwordHash) {
        throw new TRPCError4({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      }
      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError4({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      }
      await setSessionCookie(ctx, user.id, SESSION_MAX_AGE_MS);
      return { success: true, user: toPublicUser(user) };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const res = ctx.res;
      res?.clearCookie?.(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true };
    }),
    updateProfile: protectedProcedure.input(
      z2.object({
        name: z2.string().min(2).max(100).optional(),
        currentPassword: z2.string().optional(),
        newPassword: z2.string().min(8).max(128).optional()
      })
    ).mutation(async ({ ctx, input }) => {
      const user = await withTimeout(
        getUserById(ctx.user.id),
        4e3,
        "PROFILE_GET_USER"
      );
      if (!user) throw new TRPCError4({ code: "NOT_FOUND", message: "User not found" });
      const updateData = {};
      if (input.name) updateData.name = input.name;
      if (input.newPassword) {
        if (!input.currentPassword) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: "Current password is required" });
        }
        if (!user.passwordHash) {
          throw new TRPCError4({ code: "BAD_REQUEST", message: "No password set" });
        }
        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError4({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
        updateData.passwordHash = await hashPassword(input.newPassword);
      }
      if (Object.keys(updateData).length === 0) {
        return { success: true, user: toPublicUser(user) };
      }
      const updated = await withTimeout(
        updateUser(ctx.user.id, updateData),
        4e3,
        "PROFILE_UPDATE_USER"
      );
      return { success: true, user: updated ? toPublicUser(updated) : null };
    })
  }),
  projects: projectsRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  dashboard: dashboardRouter
});

// server/_core/context.ts
async function withTimeout2(promise, ms) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("AUTH_CONTEXT_TIMEOUT")), ms);
      })
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
async function createContext({
  req,
  res
}) {
  let user = null;
  try {
    user = await withTimeout2(authenticateRequest(req), 1500);
  } catch (error) {
    console.warn("[Auth] Context auth skipped:", String(error));
    user = null;
  }
  return { req, res, user };
}

// api/index.ts
var app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
var requestLogger = (req, res, next) => {
  const requestId = randomUUID();
  const startedAt = Date.now();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  console.log(
    `[HTTP] -> id=${requestId} method=${req.method} url=${req.url}`
  );
  res.on("finish", () => {
    console.log(
      `[HTTP] <- id=${requestId} status=${res.statusCode} ms=${Date.now() - startedAt}`
    );
  });
  next();
};
app.use(requestLogger);
var normalizeRoute = (req, _res, next) => {
  const parsedUrl = new URL(req.url, "http://localhost");
  const rawPath = parsedUrl.pathname;
  if (rawPath.startsWith("/api/trpc/")) {
    parsedUrl.pathname = rawPath.replace("/api/trpc/", "/");
    req.url = parsedUrl.pathname + parsedUrl.search;
    return next();
  }
  if (rawPath === "/api/trpc") {
    req.url = "/";
    return next();
  }
  return next();
};
app.use(normalizeRoute);
var trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext
});
app.use("/", trpcMiddleware);
var index_default = serverless(app);
export {
  index_default as default
};
