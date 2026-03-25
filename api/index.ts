import "dotenv/config";
import { randomUUID } from "node:crypto";
import express from "express";
import serverless from "serverless-http";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";

type RequestLike = {
  method?: string;
  url: string;
};

type ResponseLike = {
  locals: Record<string, unknown>;
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  on: (event: string, listener: () => void) => void;
  status: (code: number) => {
    json: (body: unknown) => void;
  };
};

type NextFn = () => void;

const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

const requestLogger = (req: RequestLike, res: ResponseLike, next: NextFn) => {
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

app.use(requestLogger as any);

// Normalize function/rewrite prefixes so tRPC always receives the procedure path.
const normalizeRoute = (req: RequestLike, _res: ResponseLike, next: NextFn) => {
  const parsedUrl = new URL(req.url, "http://localhost");
  const rawPath = parsedUrl.pathname;

  // Vercel dynamic function path: /api/trpc/<procedure>
  if (rawPath.startsWith("/api/trpc/")) {
    parsedUrl.pathname = rawPath.replace("/api/trpc/", "/");
    req.url = parsedUrl.pathname + parsedUrl.search;
    return next();
  }

  // Local fallback/dev compatibility
  if (rawPath === "/api/trpc") {
    req.url = "/";
    return next();
  }

  return next();
};

app.use(normalizeRoute as any);

const trpcMiddleware = createExpressMiddleware({
  router: appRouter,
  createContext,
});

app.use("/", trpcMiddleware);

export default serverless(app);