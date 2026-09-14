import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

export type AppDatabase = NodePgDatabase<typeof schema>;
export type AppTransaction = Parameters<
  Parameters<AppDatabase["transaction"]>[0]
>[0];

type DatabaseSingleton = {
  pool: Pool;
  db: AppDatabase;
};

const globalDatabase = globalThis as typeof globalThis & {
  __masterballDatabase?: DatabaseSingleton;
};

function requireDatabaseUrl(): string {
  const value = process.env.DATABASE_URL?.trim();
  if (!value || (!value.startsWith("postgres://") && !value.startsWith("postgresql://"))) {
    throw new Error(
      "DATABASE_URL is required and must be a valid PostgreSQL connection URL.",
    );
  }
  return value;
}

export function createDatabase(connectionString: string): DatabaseSingleton {
  const pool = new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });
  return { pool, db: drizzle(pool, { schema }) };
}

export function getDb(): AppDatabase {
  if (!globalDatabase.__masterballDatabase) {
    globalDatabase.__masterballDatabase = createDatabase(requireDatabaseUrl());
  }
  return globalDatabase.__masterballDatabase.db;
}

export async function closeDb(): Promise<void> {
  const current = globalDatabase.__masterballDatabase;
  if (!current) return;
  delete globalDatabase.__masterballDatabase;
  await current.pool.end();
}

export { schema };
