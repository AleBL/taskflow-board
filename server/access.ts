import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { projects } from "../drizzle/schema";
import { getDb, getTaskById, isProjectMember } from "./db";

/**
 * Authorization helpers. Every procedure that touches a project, task or
 * comment must go through one of these. Non-members get NOT_FOUND (not
 * FORBIDDEN) so IDs of other people's data are not confirmed to exist.
 */

export async function assertProjectMember(projectId: number, userId: number) {
  if (!(await isProjectMember(projectId, userId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
}

export async function assertProjectOwner(projectId: number, userId: number) {
  const db = getDb();
  const project = await db
    .select({ id: projects.id, ownerId: projects.ownerId })
    .from(projects)
    .where(eq(projects.id, projectId))
    .get();
  if (!project || !(await isProjectMember(projectId, userId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  if (project.ownerId !== userId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only the project owner can do this",
    });
  }
  return project;
}

export async function getAccessibleTask(taskId: number, userId: number) {
  const task = await getTaskById(taskId);
  if (!task || !(await isProjectMember(task.projectId, userId))) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Task not found" });
  }
  return task;
}

export async function assertAssigneeIsMember(
  projectId: number,
  assigneeId: number | null | undefined
) {
  if (!assigneeId) return;
  if (!(await isProjectMember(projectId, assigneeId))) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Assignee must be a member of the project",
    });
  }
}
