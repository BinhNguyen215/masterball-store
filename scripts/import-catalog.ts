import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { closeDb } from "../src/db/index";
import { importProductsCsv } from "../src/modules/catalog/catalog-import";

const MAX_CSV_BYTES = 2 * 1024 * 1024;

type Arguments = {
  actorId: string;
  commit: boolean;
  file: string;
};

function usage(): never {
  throw new Error(
    "Usage: pnpm import:catalog -- --file <catalog.csv> --actor <admin-user-id> [--commit]",
  );
}

function parseArguments(values: string[]): Arguments {
  let actorId = "";
  let file = "";
  let commit = false;

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === "--commit") {
      commit = true;
    } else if (value === "--file") {
      file = values[index + 1] ?? usage();
      index += 1;
    } else if (value === "--actor") {
      actorId = values[index + 1] ?? usage();
      index += 1;
    } else {
      usage();
    }
  }

  if (!file || !actorId) usage();
  return { actorId, commit, file };
}

function verifyCommitGate(commit: boolean) {
  if (!commit || process.env.NODE_ENV !== "production") return;
  if (!process.env.MIGRATION_BACKUP_REFERENCE?.trim()) {
    throw new Error(
      "Production import blocked: create and verify a backup, then set MIGRATION_BACKUP_REFERENCE.",
    );
  }
}

async function main() {
  const args = parseArguments(process.argv.slice(2));
  verifyCommitGate(args.commit);

  const csvPath = resolve(args.file);
  const csv = await readFile(csvPath, "utf8");
  if (Buffer.byteLength(csv, "utf8") > MAX_CSV_BYTES) {
    throw new Error("Catalog CSV is larger than the 2 MiB import limit.");
  }

  const result = await importProductsCsv({
    csv,
    actorId: args.actorId,
    dryRun: !args.commit,
    requestId: `cli-import-${Date.now()}`,
  });

  const inserted =
    "inserted" in result && result.inserted
      ? {
          products: result.inserted.productIds.length,
          variants: result.inserted.variantIds.length,
        }
      : undefined;
  const report = {
    mode: args.commit ? "commit" : "dry-run",
    valid: result.valid,
    rowCount: result.rows.length,
    errorCount: result.errors.length,
    errors: result.errors,
    inserted,
  };
  console.log(JSON.stringify(report, null, 2));

  if (!result.valid) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Catalog import failed.");
    process.exitCode = 1;
  })
  .finally(closeDb);
