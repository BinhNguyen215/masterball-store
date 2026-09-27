import { afterEach, describe, expect, it, vi } from "vitest";

import { assertRemoteDatabaseBackupReference } from "../../scripts/backup-gate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("remote database backup gate", () => {
  it("allows loopback databases without a backup reference", () => {
    vi.stubEnv("MIGRATION_BACKUP_REFERENCE", "");

    for (const databaseUrl of [
      "postgresql://postgres:postgres@localhost:5432/store",
      "postgresql://postgres:postgres@127.0.0.1:5432/store",
      "postgresql://postgres:postgres@[::1]:5432/store",
    ]) {
      expect(() => assertRemoteDatabaseBackupReference(databaseUrl, "Migration")).not.toThrow();
    }
  });

  it("blocks a non-loopback database without a backup reference", () => {
    vi.stubEnv("MIGRATION_BACKUP_REFERENCE", "");

    expect(() =>
      assertRemoteDatabaseBackupReference(
        "postgresql://importer:super-secret@db.internal.example.com:5432/store",
        "Catalog import",
      ),
    ).toThrowError(/^Catalog import blocked: the database target is not localhost\./);
  });

  it("does not echo connection credentials in the failure message", () => {
    vi.stubEnv("MIGRATION_BACKUP_REFERENCE", "");

    try {
      assertRemoteDatabaseBackupReference(
        "postgresql://importer:super-secret@db.internal.example.com:5432/store",
        "Migration",
      );
      expect.unreachable("the gate must throw for a remote database");
    } catch (error) {
      expect((error as Error).message).not.toContain("super-secret");
    }
  });

  it("allows a non-loopback database once a backup reference is recorded", () => {
    vi.stubEnv("MIGRATION_BACKUP_REFERENCE", "s3://backups/2026-09-28/commerce.dump");

    expect(() =>
      assertRemoteDatabaseBackupReference(
        "postgresql://importer:super-secret@db.internal.example.com:5432/store",
        "Migration",
      ),
    ).not.toThrow();
  });

  it("fails closed when DATABASE_URL is missing or unparseable", () => {
    vi.stubEnv("MIGRATION_BACKUP_REFERENCE", "");

    expect(() => assertRemoteDatabaseBackupReference(undefined, "Migration")).toThrowError(
      /Migration blocked: the database target is not localhost\./,
    );
    expect(() => assertRemoteDatabaseBackupReference("not-a-url", "Migration")).toThrowError(
      /Migration blocked: the database target is not localhost\./,
    );
  });
});
