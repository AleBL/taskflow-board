import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '../../shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;

const tracingMiddleware = t.middleware(async opts => {
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
    const message =
      error instanceof Error ? error.message : "unknown_trpc_error";
    console.error(
      `[TRPC] <- id=${requestId} type=${opts.type} path=${path} error=${message} ms=${Date.now() - startedAt}`
    );
    throw error;
  }
});

export const publicProcedure = t.procedure.use(tracingMiddleware);

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure
  .use(tracingMiddleware)
  .use(requireUser);

export const adminProcedure = t.procedure
  .use(tracingMiddleware)
  .use(
    t.middleware(async opts => {
      const { ctx, next } = opts;

      if (!ctx.user || ctx.user.role !== 'admin') {
        throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
      }

      return next({
        ctx: {
          ...ctx,
          user: ctx.user,
        },
      });
    }),
  );
