import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import "dotenv/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error("❌  TURSO_DATABASE_URL is not set.");
  console.error("    Set it in your .env file or environment variables.");
  process.exit(1);
}

console.log(`🔗  Connecting to: ${url}`);

const client = createClient({ url, authToken });

const migrationsDir = join(__dirname, "../drizzle/migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.log("⚠️   No migration files found. Run `pnpm drizzle-kit generate` first.");
  process.exit(0);
}

console.log(`📂  Found ${files.length} migration file(s):`);
for (const file of files) {
  console.log(`    - ${file}`);
}

await client.execute(`
  CREATE TABLE IF NOT EXISTS __drizzle_migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
  )
`);

for (const file of files) {
  const hash = file.replace(".sql", "");

  const existing = await client.execute({
    sql: "SELECT id FROM __drizzle_migrations WHERE hash = ?",
    args: [hash],
  });

  if (existing.rows.length > 0) {
    console.log(`⏭️   Skipping (already applied): ${file}`);
    continue;
  }

  const sql = readFileSync(join(migrationsDir, file), "utf-8");

  const statements = sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

  console.log(`⚡  Applying: ${file} (${statements.length} statement(s))`);

  for (const statement of statements) {
    await client.execute(statement);
  }

  await client.execute({
    sql: "INSERT INTO __drizzle_migrations (hash) VALUES (?)",
    args: [hash],
  });

  console.log(`✅  Applied: ${file}`);
}

console.log("\n🎉  All migrations applied successfully!");
await client.close();
