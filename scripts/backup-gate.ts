/**
 * Backup safety gate shared by the migration and catalog-import scripts.
 *
 * The gate cannot key on `NODE_ENV`: developer shells and the `.env.local`
 * written by the Vercel CLI leave it at `development` even when `DATABASE_URL`
 * targets the production database. It keys on the database target instead — a
 * verified backup is required as soon as the connection leaves loopback.
 */
const LOOPBACK_HOSTS: Record<string, true> = {
  localhost: true,
  "127.0.0.1": true,
  "::1": true,
  "[::1]": true,
};

/**
 * Blocks a write to a non-loopback database unless the operator recorded a
 * verified backup artifact in `MIGRATION_BACKUP_REFERENCE`. An unparseable or
 * absent `DATABASE_URL` counts as remote so the gate fails closed.
 */
export function assertRemoteDatabaseBackupReference(
  databaseUrl: string | undefined,
  action: string,
): void {
  let isLoopback: boolean;
  try {
    isLoopback = LOOPBACK_HOSTS[new URL(databaseUrl ?? "").hostname.toLowerCase()] === true;
  } catch {
    // An absent or unparseable URL counts as remote so the gate fails closed.
    isLoopback = false;
  }

  if (isLoopback) return;
  if (process.env.MIGRATION_BACKUP_REFERENCE?.trim()) return;

  throw new Error(
    `${action} blocked: the database target is not localhost. Create and verify a database backup, then set MIGRATION_BACKUP_REFERENCE to its artifact identifier.`,
  );
}
