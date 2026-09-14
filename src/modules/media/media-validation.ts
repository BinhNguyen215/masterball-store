import { randomBytes } from "node:crypto";

import sharp from "sharp";

const allowedFormats = new Map([
  ["jpeg", "image/jpeg"],
  ["png", "image/png"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
] as const);

export class MediaValidationError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "MediaValidationError";
  }
}

export async function validateProductMedia(input: {
  bytes: Buffer;
  altText: string;
  maxBytes?: number;
  maxDimension?: number;
}) {
  const maxBytes = input.maxBytes ?? 10 * 1024 * 1024;
  const maxDimension = input.maxDimension ?? 8_000;
  const altText = input.altText.trim();
  if (!altText) throw new MediaValidationError("Media alt text is required.");
  if (!input.bytes.length || input.bytes.length > maxBytes) {
    throw new MediaValidationError(`Media must be between 1 and ${maxBytes} bytes.`);
  }
  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>["metadata"]>>;
  try {
    metadata = await sharp(input.bytes, {
      failOn: "error",
      limitInputPixels: maxDimension * maxDimension,
    }).metadata();
  } catch (error) {
    throw new MediaValidationError("Media bytes are not a valid raster image.", {
      cause: error,
    });
  }
  const mimeType = metadata.format
    ? allowedFormats.get(metadata.format as "jpeg" | "png" | "webp" | "avif")
    : undefined;
  if (!mimeType || !metadata.width || !metadata.height) {
    throw new MediaValidationError("Media content is not a supported raster image.");
  }
  if (metadata.width > maxDimension || metadata.height > maxDimension) {
    throw new MediaValidationError(
      `Media dimensions must not exceed ${maxDimension}px.`,
    );
  }
  const extension = metadata.format === "jpeg" ? "jpg" : metadata.format;
  return {
    objectKey: `products/${randomBytes(24).toString("hex")}.${extension}`,
    mimeType,
    width: metadata.width,
    height: metadata.height,
    byteSize: input.bytes.length,
    altText,
  };
}
