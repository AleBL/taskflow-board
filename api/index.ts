/**
 * Vercel Serverless Function entry point.
 * This file wraps the Express app for Vercel's serverless runtime.
 *
 * Deploy steps:
 * 1. Push this repo to GitHub
 * 2. Import project on vercel.com
 * 3. Set the environment variables listed in .env.example
 * 4. Vercel will auto-detect vercel.json and deploy
 */
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
const app = express();

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
