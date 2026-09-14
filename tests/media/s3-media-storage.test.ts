import {
  DeleteObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

import {
  buildPublicMediaUrl,
  MediaManagementError,
  type MediaStorage,
  moveMediaToSortOrder,
  runWithObjectCompensation,
  S3CompatibleMediaStorage,
} from "@/modules/media";

const objectKey = `products/${"a".repeat(48)}.webp`;
const config = {
  endpoint: "https://s3.example.test",
  region: "auto",
  bucket: "masterball-media",
  accessKeyId: "test-access-key",
  secretAccessKey: "test-secret-key",
  publicBaseUrl: "https://cdn.example.test/store-media/",
};

describe("S3-compatible media storage", () => {
  it("constructs its sender lazily and sends server-owned Put/Delete commands", async () => {
    const commands: Array<PutObjectCommand | DeleteObjectCommand> = [];
    const send = vi.fn(async (command: PutObjectCommand | DeleteObjectCommand) => {
      commands.push(command);
      return {};
    });
    const senderFactory = vi.fn(() => ({ send }));
    const storage = new S3CompatibleMediaStorage(config, senderFactory);

    expect(senderFactory).not.toHaveBeenCalled();
    expect(storage.publicUrl(objectKey)).toBe(
      `https://cdn.example.test/store-media/${objectKey}`,
    );
    expect(senderFactory).not.toHaveBeenCalled();

    await storage.putObject({
      objectKey,
      bytes: Buffer.from("raster"),
      mimeType: "image/webp",
    });
    await storage.deleteObject(objectKey);

    expect(senderFactory).toHaveBeenCalledTimes(1);
    expect(commands[0]).toBeInstanceOf(PutObjectCommand);
    expect(commands[0].input).toMatchObject({
      Bucket: "masterball-media",
      Key: objectKey,
      ContentType: "image/webp",
      ContentLength: 6,
    });
    expect(commands[1]).toBeInstanceOf(DeleteObjectCommand);
    expect(commands[1].input).toMatchObject({
      Bucket: "masterball-media",
      Key: objectKey,
    });
  });

  it("rejects traversal, arbitrary buckets, and client-style object keys", async () => {
    expect(() => buildPublicMediaUrl(config.publicBaseUrl, "../secret.txt")).toThrow();
    const storage = new S3CompatibleMediaStorage(config, () => ({
      send: vi.fn(async () => ({})),
    }));
    await expect(
      storage.deleteObject("products/client-file-name.png"),
    ).rejects.toThrow("not owned");
  });
});

describe("media persistence rules", () => {
  it("deletes an uploaded object when database persistence fails", async () => {
    const persistenceError = new Error("database failed");
    const storage: MediaStorage = {
      putObject: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => undefined),
      publicUrl: (key) => key,
    };
    await expect(
      runWithObjectCompensation(storage, objectKey, async () => {
        throw persistenceError;
      }),
    ).rejects.toBe(persistenceError);
    expect(storage.deleteObject).toHaveBeenCalledWith(objectKey);
  });

  it("surfaces a distinct error when object compensation also fails", async () => {
    const storage: MediaStorage = {
      putObject: vi.fn(async () => undefined),
      deleteObject: vi.fn(async () => {
        throw new Error("S3 unavailable");
      }),
      publicUrl: (key) => key,
    };
    const result = runWithObjectCompensation(storage, objectKey, async () => {
      throw new Error("database failed");
    });
    await expect(result).rejects.toMatchObject<Partial<MediaManagementError>>({
      code: "OBJECT_COMPENSATION_FAILED",
    });
  });

  it("moves the selected row and defines sort order 0 as primary", () => {
    const rows = [{ id: "a" }, { id: "b" }, { id: "c" }];
    expect(moveMediaToSortOrder(rows, "c", 0).map((row) => row.id)).toEqual([
      "c",
      "a",
      "b",
    ]);
    expect(moveMediaToSortOrder(rows, "a", 99).map((row) => row.id)).toEqual([
      "b",
      "c",
      "a",
    ]);
  });
});
