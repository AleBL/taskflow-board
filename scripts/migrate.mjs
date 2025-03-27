import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbDir = path.join(__dirname, "..", "data");
const dbPath = path.join(dbDir, "taskflow.db");
const migrationPath = path.join(__dirname, "..", "drizzle", "migrations", "0000_wakeful_expediter.sql");

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const sql = fs.readFileSync(migrationPath, "utf8");
const statements = sql
  .split("--> statement-breakpoint")
  .map((s) => s.trim())
  .filter(Boolean);

let applied = 0;
for (const stmt of statements) {
  try {
    db.exec(stmt);
    applied++;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("already exists")) {
      console.log(`  [skip] Table already exists`);
    } else {
      console.error(`  [error] ${msg}`);
    }
  }
}

const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
  .all()
  .map((r) => r.name);

console.log(`Migration complete. Applied ${applied} statements.`);
console.log(`Tables: ${tables.join(", ")}`);
db.close();
