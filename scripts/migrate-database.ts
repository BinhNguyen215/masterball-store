import { migrate } from "drizzle-orm/node-postgres/migrator";

import { createDatabase } from "../src/db/index";

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

function verifyProductionBackupGate() {
  if (process.env.NODE_ENV !== "production") {
    return;
  }

  const backupReference = process.env.MIGRATION_BACKUP_REFERENCE?.trim();
  if (!backupReference) {
    throw new Error(
      "Production migration blocked: create and verify a database backup, then set MIGRATION_BACKUP_REFERENCE to its artifact identifier.",
    );
  }
}

async function main() {
  verifyProductionBackupGate();
  const { db, pool } = createDatabase(requireDatabaseUrl());

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
