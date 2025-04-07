import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getProjectsByOwner,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  getTasksByProject,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  searchTasks,
  getCommentsByTask,
  createComment,
  deleteComment,
  getDashboardMetrics,
  getUserByEmail,
  createLocalUser,
} from "./db";
import { hashPassword, verifyPassword, signSession } from "./auth";

// ─── Projects Router ──────────────────────────────────────────────────────────

const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    getProjectsByOwner(ctx.user.id)
  ),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const project = await getProjectById(input.id, ctx.user.id);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      return project;
    }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(({ ctx, input }) =>
      createProject({
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? "#6366f1",
        ownerId: ctx.user.id,
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional().nullable(),
        color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const project = await updateProject(id, ctx.user.id, data);
      if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      return project;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteProject(input.id, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
      return { success: true };
    }),
});

// ─── Tasks Router ─────────────────────────────────────────────────────────────

const tasksRouter = router({
  listByProject: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(({ input }) => getTasksByProject(input.projectId)),

  search: protectedProcedure
    .input(
      z.object({
        search: z.string().optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        projectId: z.number().int().positive().optional(),
      })
    )
    .query(({ ctx, input }) =>
      searchTasks({ ownerId: ctx.user.id, ...input })
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const task = await getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return task;
    }),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.number().optional().nullable(),
        projectId: z.number().int().positive(),
      })
    )
    .mutation(({ input }) =>
      createTask({
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "todo",
        priority: input.priority ?? "medium",
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        projectId: input.projectId,
      })
    ),

  update: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional().nullable(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.number().optional().nullable(),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { id, dueDate, ...rest } = input;
      const task = await updateTask(id, {
        ...rest,
        dueDate: dueDate !== undefined ? (dueDate ? new Date(dueDate) : null) : undefined,
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return task;
    }),

  updateStatus: protectedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
        status: z.enum(["todo", "in_progress", "done"]),
        position: z.number().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const task = await updateTask(input.id, {
        status: input.status,
        position: input.position,
      });
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return task;
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ input }) => {
      const deleted = await deleteTask(input.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return { success: true };
    }),
});

// ─── Comments Router ──────────────────────────────────────────────────────────

const commentsRouter = router({
  listByTask: protectedProcedure
    .input(z.object({ taskId: z.number().int().positive() }))
    .query(({ input }) => getCommentsByTask(input.taskId)),

  create: protectedProcedure
    .input(
      z.object({
        taskId: z.number().int().positive(),
        content: z.string().min(1).max(2000),
      })
    )
    .mutation(({ ctx, input }) =>
      createComment({
        taskId: input.taskId,
        content: input.content,
        authorId: ctx.user.id,
      })
    ),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const deleted = await deleteComment(input.id, ctx.user.id);
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND", message: "Comment not found" });
      return { success: true };
    }),
});

// ─── Dashboard Router ─────────────────────────────────────────────────────────

const dashboardRouter = router({
  metrics: protectedProcedure.query(({ ctx }) =>
    getDashboardMetrics(ctx.user.id)
  ),
});

// ─── App Router ───────────────────────────────────────────────────────────────

export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),

    register: publicProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100),
          email: z.string().email(),
          password: z.string().min(8).max(128),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const existing = await getUserByEmail(input.email);
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already in use",
          });
        }
        const passwordHash = await hashPassword(input.password);
        const user = await createLocalUser({
          name: input.name,
          email: input.email,
          passwordHash,
        });
        const token = await signSession(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 365 * 24 * 60 * 60 * 1000,
        });
        return {
          success: true,
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
        };
      }),

    login: publicProcedure
      .input(
        z.object({
          email: z.string().email(),
          password: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const user = await getUserByEmail(input.email);
        if (!user || !user.passwordHash) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }
        const valid = await verifyPassword(input.password, user.passwordHash);
        if (!valid) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Invalid email or password",
          });
        }
        const token = await signSession(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(COOKIE_NAME, token, {
          ...cookieOptions,
          maxAge: 365 * 24 * 60 * 60 * 1000,
        });
        return {
          success: true,
          user: { id: user.id, name: user.name, email: user.email, role: user.role },
        };
      }),

    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  projects: projectsRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
