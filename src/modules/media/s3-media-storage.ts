import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

export const OWNED_MEDIA_KEY = /^products\/[a-f0-9]{48}\.(?:jpg|png|webp|avif)$/;

export type MediaStoragePut = {
  objectKey: string;
  bytes: Buffer;
  mimeType: string;
};

export interface MediaStorage {
  putObject(input: MediaStoragePut): Promise<void>;
  deleteObject(objectKey: string): Promise<void>;
  publicUrl(objectKey: string): string;
}

export class MediaStorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MediaStorageError";
  }
}

type S3Command = PutObjectCommand | DeleteObjectCommand;
type CommandSender = { send(command: S3Command): Promise<unknown> };

export type S3MediaStorageConfig = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  publicBaseUrl: string;
};

function requireOwnedObjectKey(objectKey: string): void {
  if (!OWNED_MEDIA_KEY.test(objectKey)) {
    throw new Error("Media object key is not owned by the product-media namespace.");
  }
}

export function buildPublicMediaUrl(
  publicBaseUrl: string,
  objectKey: string,
): string {
  requireOwnedObjectKey(objectKey);
  const url = new URL(publicBaseUrl);
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("S3_PUBLIC_BASE_URL must use HTTP or HTTPS.");
  }
  url.search = "";
  url.hash = "";
  const basePath = url.pathname.replace(/\/$/, "");
  const encodedKey = objectKey.split("/").map(encodeURIComponent).join("/");
  url.pathname = `${basePath}/${encodedKey}`;
  return url.toString();
}

export class S3CompatibleMediaStorage implements MediaStorage {
  private sender: CommandSender | undefined;

  constructor(
    private readonly config: S3MediaStorageConfig,
    private readonly senderFactory: () => CommandSender = () =>
      new S3Client({
        endpoint: config.endpoint,
        region: config.region,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
        forcePathStyle: true,
      }) as CommandSender,
  ) {}

  private getSender(): CommandSender {
    this.sender ??= this.senderFactory();
    return this.sender;
  }

  async putObject(input: MediaStoragePut): Promise<void> {
    requireOwnedObjectKey(input.objectKey);
    try {
      await this.getSender().send(
        new PutObjectCommand({
          Bucket: this.config.bucket,
          Key: input.objectKey,
          Body: input.bytes,
          ContentLength: input.bytes.byteLength,
          ContentType: input.mimeType,
          CacheControl: "public, max-age=31536000, immutable",
        }),
      );
    } catch (error) {
      throw new MediaStorageError(`Unable to put media object ${input.objectKey}.`, {
        cause: error,
      });
    }
  }

  async deleteObject(objectKey: string): Promise<void> {
    requireOwnedObjectKey(objectKey);
    try {
      await this.getSender().send(
        new DeleteObjectCommand({
          Bucket: this.config.bucket,
          Key: objectKey,
        }),
      );
    } catch (error) {
      throw new MediaStorageError(`Unable to delete media object ${objectKey}.`, {
        cause: error,
      });
    }
  }

  publicUrl(objectKey: string): string {
    return buildPublicMediaUrl(this.config.publicBaseUrl, objectKey);
  }
}

let defaultStorage: MediaStorage | undefined;

export async function getDefaultMediaStorage(): Promise<MediaStorage> {
  if (!defaultStorage) {
    // Dynamic import keeps environment parsing and AWS client construction out
    // of module import. This module remains safe during builds without secrets.
    const { getStorageEnvironment } = await import("@/config/environment");
    const environment = getStorageEnvironment();
    defaultStorage = new S3CompatibleMediaStorage({
      endpoint: environment.S3_ENDPOINT,
      region: environment.S3_REGION,
      bucket: environment.S3_BUCKET,
      accessKeyId: environment.S3_ACCESS_KEY_ID,
      secretAccessKey: environment.S3_SECRET_ACCESS_KEY,
      publicBaseUrl: environment.S3_PUBLIC_BASE_URL,
    });
  }
  return defaultStorage;
}
