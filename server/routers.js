// server/routers.ts
import { z as z2 } from "zod";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;
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
  const secure = isSecureRequest(req);
  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "none" : "lax",
    secure
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
var publicProcedure = t.procedure;
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
var protectedProcedure = t.procedure.use(requireUser);
var adminProcedure = t.procedure.use(
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
import { TRPCError as TRPCError2 } from "@trpc/server";

// server/db.ts
import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import { eq, and, like, desc, asc, inArray } from "drizzle-orm";

// drizzle/schema.ts
import {
  integer,
  sqliteTable,
  text,
  real
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
});
var projectMembers = sqliteTable("project_members", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  projectId: integer("projectId").notNull().references(() => projects.id, { onDelete: "cascade" }),
  userId: integer("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role", { enum: ["owner", "member"] }).notNull().default("member"),
  joinedAt: integer("joinedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
});
var comments = sqliteTable("comments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  content: text("content").notNull(),
  taskId: integer("taskId").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: integer("authorId").notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: integer("createdAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`),
  updatedAt: integer("updatedAt", { mode: "timestamp_ms" }).notNull().default(sql`(unixepoch() * 1000)`)
});

// server/_core/env.ts
var ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.TURSO_DATABASE_URL ?? process.env.DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
  ownerOpenId: "",
  isProduction: process.env.NODE_ENV === "production"
};

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
async function getAllUsers() {
  const db = getDb();
  return db.select({ id: users.id, name: users.name, email: users.email }).from(users).orderBy(asc(users.name)).all();
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
  const existing = await db.select({ id: projectMembers.id }).from(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId))).get();
  if (!existing) {
    await db.insert(projectMembers).values({
      projectId,
      userId,
      role,
      joinedAt: /* @__PURE__ */ new Date()
    });
  }
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
  const task = result[0];
  if (data.assigneeId) {
    await addProjectMember(data.projectId, data.assigneeId, "member");
  }
  return task;
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
  const task = result[0] ?? null;
  if (task && data.assigneeId) {
    await addProjectMember(task.projectId, data.assigneeId, "member");
  }
  return task;
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
  const now = /* @__PURE__ */ new Date();
  let todo = 0, inProgress = 0, done = 0, overdue = 0;
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

// server/auth.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
var BCRYPT_ROUNDS = 12;
function getSecretKey() {
  const secret = ENV.cookieSecret || "fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
}
async function signSession(userId) {
  return new SignJWT({ sub: String(userId) }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("365d").sign(getSecretKey());
}
async function hashPassword(password) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}
async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// server/routers.ts
var projectsRouter = router({
  list: protectedProcedure.query(
    ({ ctx }) => getProjectsByUser(ctx.user.id)
  ),
  getById: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ ctx, input }) => {
    const project = await getProjectById(input.id, ctx.user.id);
    if (!project) throw new TRPCError2({ code: "NOT_FOUND", message: "Project not found" });
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
    if (!project) throw new TRPCError2({ code: "NOT_FOUND", message: "Project not found" });
    return project;
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const deleted = await deleteProject(input.id, ctx.user.id);
    if (!deleted) throw new TRPCError2({ code: "NOT_FOUND", message: "Project not found" });
    return { success: true };
  })
});
var usersRouter = router({
  list: protectedProcedure.query(() => getAllUsers())
});
var tasksRouter = router({
  listByProject: protectedProcedure.input(z2.object({ projectId: z2.number().int().positive() })).query(({ input }) => getTasksByProject(input.projectId)),
  search: protectedProcedure.input(
    z2.object({
      search: z2.string().optional(),
      status: z2.enum(["todo", "in_progress", "done"]).optional(),
      priority: z2.enum(["low", "medium", "high"]).optional(),
      projectId: z2.number().int().positive().optional()
    })
  ).query(
    ({ ctx, input }) => searchTasks({ userId: ctx.user.id, ...input })
  ),
  getById: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).query(async ({ input }) => {
    const task = await getTaskById(input.id);
    if (!task) throw new TRPCError2({ code: "NOT_FOUND", message: "Task not found" });
    return task;
  }),
  members: protectedProcedure.input(z2.object({ projectId: z2.number().int().positive() })).query(({ input }) => getProjectMembersList(input.projectId)),
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
  ).mutation(
    ({ input }) => createTask({
      title: input.title,
      description: input.description ?? null,
      status: input.status ?? "todo",
      priority: input.priority ?? "medium",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      projectId: input.projectId,
      assigneeId: input.assigneeId ?? null
    })
  ),
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
  ).mutation(async ({ input }) => {
    const { id, dueDate, ...rest } = input;
    const task = await updateTask(id, {
      ...rest,
      dueDate: dueDate !== void 0 ? dueDate ? new Date(dueDate) : null : void 0
    });
    if (!task) throw new TRPCError2({ code: "NOT_FOUND", message: "Task not found" });
    return task;
  }),
  updateStatus: protectedProcedure.input(
    z2.object({
      id: z2.number().int().positive(),
      status: z2.enum(["todo", "in_progress", "done"]),
      position: z2.number().optional()
    })
  ).mutation(async ({ input }) => {
    const task = await updateTask(input.id, {
      status: input.status,
      position: input.position
    });
    if (!task) throw new TRPCError2({ code: "NOT_FOUND", message: "Task not found" });
    return task;
  }),
  delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ input }) => {
    const deleted = await deleteTask(input.id);
    if (!deleted) throw new TRPCError2({ code: "NOT_FOUND", message: "Task not found" });
    return { success: true };
  })
});
var commentsRouter = router({
  listByTask: protectedProcedure.input(z2.object({ taskId: z2.number().int().positive() })).query(({ input }) => getCommentsByTask(input.taskId)),
  create: protectedProcedure.input(
    z2.object({
      taskId: z2.number().int().positive(),
      content: z2.string().min(1).max(2e3)
    })
  ).mutation(
    ({ ctx, input }) => createComment({
      taskId: input.taskId,
      content: input.content,
      authorId: ctx.user.id
    })
  ),
  delete: protectedProcedure.input(z2.object({ id: z2.number().int().positive() })).mutation(async ({ ctx, input }) => {
    const deleted = await deleteComment(input.id, ctx.user.id);
    if (!deleted) throw new TRPCError2({ code: "NOT_FOUND", message: "Comment not found" });
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
    me: publicProcedure.query((opts) => opts.ctx.user),
    register: publicProcedure.input(
      z2.object({
        name: z2.string().min(2).max(100),
        email: z2.string().email(),
        password: z2.string().min(8).max(128)
      })
    ).mutation(async ({ input, ctx }) => {
      const existing = await getUserByEmail(input.email);
      if (existing) {
        throw new TRPCError2({
          code: "CONFLICT",
          message: "Email already in use"
        });
      }
      const passwordHash = await hashPassword(input.password);
      const user = await createLocalUser({
        name: input.name,
        email: input.email,
        passwordHash
      });
      const token = await signSession(user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const res = ctx.res;
      res?.cookie?.(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1e3
      });
      return {
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      };
    }),
    login: publicProcedure.input(
      z2.object({
        email: z2.string().email(),
        password: z2.string().min(1)
      })
    ).mutation(async ({ input, ctx }) => {
      const user = await getUserByEmail(input.email);
      if (!user || !user.passwordHash) {
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      }
      const valid = await verifyPassword(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError2({
          code: "UNAUTHORIZED",
          message: "Invalid email or password"
        });
      }
      const token = await signSession(user.id);
      const cookieOptions = getSessionCookieOptions(ctx.req);
      const res = ctx.res;
      res?.cookie?.(COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 365 * 24 * 60 * 60 * 1e3
      });
      return {
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role }
      };
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
      const user = await getUserById(ctx.user.id);
      if (!user) throw new TRPCError2({ code: "NOT_FOUND", message: "User not found" });
      const updateData = {};
      if (input.name) updateData.name = input.name;
      if (input.newPassword) {
        if (!input.currentPassword) {
          throw new TRPCError2({ code: "BAD_REQUEST", message: "Current password is required" });
        }
        if (!user.passwordHash) {
          throw new TRPCError2({ code: "BAD_REQUEST", message: "No password set" });
        }
        const valid = await verifyPassword(input.currentPassword, user.passwordHash);
        if (!valid) {
          throw new TRPCError2({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
        }
        updateData.passwordHash = await hashPassword(input.newPassword);
      }
      if (Object.keys(updateData).length === 0) {
        return { success: true, user };
      }
      const updated = await updateUser(ctx.user.id, updateData);
      return { success: true, user: updated };
    })
  }),
  users: usersRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  dashboard: dashboardRouter
});
export {
  appRouter
};
