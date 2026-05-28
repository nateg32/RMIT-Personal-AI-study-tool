import { spawnSync } from "node:child_process";

const dbUrl = process.env.SUPABASE_DB_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!dbUrl) {
  console.error("Set SUPABASE_DB_URL, DIRECT_URL, or DATABASE_URL before running this command.");
  process.exit(1);
}

const result = spawnSync(
  process.platform === "win32" ? "npx.cmd" : "npx",
  ["supabase", "db", "push", "--db-url", dbUrl, "--include-all", "--yes"],
  { stdio: "inherit" },
);

process.exit(result.status ?? 1);
