import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { User } from "../drizzle/schema";
import type { TrpcContext } from "./_core/context";
import { setDb } from "./db";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../drizzle/migrations", import.meta.url)
);

/**
 * Test database built from the real migrations (not a hand-written copy of
 * the schema), stored in a temp file because libSQL ":memory:" databases do
 * not survive across connections.
 */
export async function setupTestDb() {
  const dir = mkdtempSync(join(tmpdir(), "taskflow-test-"));
  const client = createClient({ url: `file:${join(dir, "test.db")}` });

  const files = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const statements = readFileSync(join(MIGRATIONS_DIR, file), "utf-8")
      .split("--> statement-breakpoint")
      .map(s => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      await client.execute(statement);
    }
  }

  const db = drizzle(client);
  setDb(db);

  return {
    db,
    cleanup() {
      client.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

type CookieCall = {
  name: string;
  value: string;
  options: Record<string, unknown>;
};

let ipCounter = 0;

/** Fresh tRPC context; each one gets its own IP so rate limits don't leak between tests. */
export function createTestContext(user: User | null = null, ip?: string) {
  const setCookies: CookieCall[] = [];
  const clearCookies: { name: string; options: Record<string, unknown> }[] = [];
  ipCounter += 1;

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: { "x-forwarded-for": ip ?? `198.51.100.${ipCounter % 250}` },
    } as unknown as TrpcContext["req"],
    res: {
      cookie: (
        name: string,
        value: string,
        options: Record<string, unknown>
      ) => {
        setCookies.push({ name, value, options });
      },
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearCookies.push({ name, options });
      },
    } as unknown as TrpcContext["res"],
  };

  return { ctx, setCookies, clearCookies };
}
