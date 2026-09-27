import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "../src/db/index";
import { assertRemoteDatabaseBackupReference } from "./backup-gate";

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();

  if (!value) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const parsed = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw new Error("DATABASE_URL must use the PostgreSQL protocol.");
  }

  return value;
}

async function main() {
  const databaseUrl = requireDatabaseUrl();
  assertRemoteDatabaseBackupReference(databaseUrl, "Migration");
  const { db, pool } = createDatabase(databaseUrl);

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
    console.log("Database migrations completed.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration error";
  console.error(message);
  process.exitCode = 1;
});
