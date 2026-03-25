import { z } from "zod";
import { COOKIE_NAME } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import {
  getProjectsByUser,
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
  getUserById,
  createLocalUser,
  updateUser,
  getProjectMembersList,
  getAllUsers,
} from "./db";
import { hashPassword, verifyPassword, signSession } from "./auth";

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type ResponseWithCookies = {
  cookie?: (name: string, value: string, options?: Record<string, unknown>) => void;
  clearCookie?: (name: string, options?: Record<string, unknown>) => void;
};

// ─── Projects Router ──────────────────────────────────────────────────────────

const projectsRouter = router({
  list: protectedProcedure.query(({ ctx }) =>
    getProjectsByUser(ctx.user.id)
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

const usersRouter = router({
  list: protectedProcedure.query(() => getAllUsers()),
});

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
      searchTasks({ userId: ctx.user.id, ...input })
    ),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .query(async ({ input }) => {
      const task = await getTaskById(input.id);
      if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
      return task;
    }),

  members: protectedProcedure
    .input(z.object({ projectId: z.number().int().positive() }))
    .query(({ input }) => getProjectMembersList(input.projectId)),

  create: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        status: z.enum(["todo", "in_progress", "done"]).optional(),
        priority: z.enum(["low", "medium", "high"]).optional(),
        dueDate: z.number().optional().nullable(),
        projectId: z.number().int().positive(),
        assigneeId: z.number().int().positive().optional().nullable(),
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
        assigneeId: input.assigneeId ?? null,
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
        assigneeId: z.number().int().positive().optional().nullable(),
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

const dashboardRouter = router({
  metrics: protectedProcedure.query(({ ctx }) =>
    getDashboardMetrics(ctx.user.id)
  ),
});

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
        const existing = await withTimeout(
          getUserByEmail(input.email),
          4000,
          "REGISTER_GET_USER"
        );
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Email already in use",
          });
        }
        const passwordHash = await hashPassword(input.password);
        const user = await withTimeout(
          createLocalUser({
          name: input.name,
          email: input.email,
          passwordHash,
          }),
          4000,
          "REGISTER_CREATE_USER"
        );
        const token = await signSession(user.id);
        const cookieOptions = getSessionCookieOptions(ctx.req);
        const res = ctx.res as unknown as ResponseWithCookies | undefined;
        res?.cookie?.(COOKIE_NAME, token, {
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
        const user = await withTimeout(
          getUserByEmail(input.email),
          4000,
          "LOGIN_GET_USER"
        );
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
        const res = ctx.res as unknown as ResponseWithCookies | undefined;
        res?.cookie?.(COOKIE_NAME, token, {
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
      const res = ctx.res as unknown as ResponseWithCookies | undefined;
      res?.clearCookie?.(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),

    updateProfile: protectedProcedure
      .input(
        z.object({
          name: z.string().min(2).max(100).optional(),
          currentPassword: z.string().optional(),
          newPassword: z.string().min(8).max(128).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const user = await withTimeout(
          getUserById(ctx.user.id),
          4000,
          "PROFILE_GET_USER"
        );
        if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });

        const updateData: Partial<{ name: string; passwordHash: string }> = {};

        if (input.name) updateData.name = input.name;

        if (input.newPassword) {
          if (!input.currentPassword) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "Current password is required" });
          }
          if (!user.passwordHash) {
            throw new TRPCError({ code: "BAD_REQUEST", message: "No password set" });
          }
          const valid = await verifyPassword(input.currentPassword, user.passwordHash);
          if (!valid) {
            throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect" });
          }
          updateData.passwordHash = await hashPassword(input.newPassword);
        }

        if (Object.keys(updateData).length === 0) {
          return { success: true, user };
        }

        const updated = await withTimeout(
          updateUser(ctx.user.id, updateData),
          4000,
          "PROFILE_UPDATE_USER"
        );
        return { success: true, user: updated };
      }),
  }),

  users: usersRouter,
  projects: projectsRouter,
  tasks: tasksRouter,
  comments: commentsRouter,
  dashboard: dashboardRouter,
});

export type AppRouter = typeof appRouter;
