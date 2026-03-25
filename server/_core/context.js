// server/auth.ts
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";

// shared/const.ts
var COOKIE_NAME = "app_session_id";
var ONE_YEAR_MS = 1e3 * 60 * 60 * 24 * 365;

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

// server/auth.ts
function getSecretKey() {
  const secret = ENV.cookieSecret || "fallback-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
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

// server/_core/context.ts
async function createContext({
  req,
  res
}) {
  let user = null;
  try {
    user = await authenticateRequest(req);
  } catch {
    user = null;
  }
  return { req, res, user };
}
export {
  createContext
};
