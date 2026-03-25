import type { Request, Response } from "express";
import type { User } from "../../drizzle/schema";
import { authenticateRequest } from "../auth";

export type TrpcContext = {
  req: Request;
  res: Response;
  user: User | null;
};

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error("AUTH_CONTEXT_TIMEOUT")), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function createContext({
  req,
  res,
}: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> {
  let user: User | null = null;
  try {
    user = await withTimeout(authenticateRequest(req), 1500);
  } catch (error) {
    console.warn("[Auth] Context auth skipped:", String(error));
    user = null;
  }
  return { req, res, user };
}