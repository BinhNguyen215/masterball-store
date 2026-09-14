import sharp from "sharp";
import { describe, expect, it } from "vitest";

import {
  MediaValidationError,
  validateProductMedia,
} from "@/modules/media";

describe("product media validation", () => {
  it("inspects real raster bytes and ignores any client filename", async () => {
    const bytes = await sharp({
      create: {
        width: 4,
        height: 3,
        channels: 4,
        background: { r: 109, g: 40, b: 217, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await validateProductMedia({
      bytes,
      altText: "  Hộp bài màu tím  ",
    });

    expect(result).toMatchObject({
      mimeType: "image/png",
      width: 4,
      height: 3,
      byteSize: bytes.length,
      altText: "Hộp bài màu tím",
    });
    expect(result.objectKey).toMatch(/^products\/[a-f0-9]{48}\.png$/);
  });

  it("rejects non-raster content, empty alt text, and files over 10 MB", async () => {
    await expect(
      validateProductMedia({
        bytes: Buffer.from("<svg><script>alert(1)</script></svg>"),
        altText: "Unsafe SVG",
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    await expect(
      validateProductMedia({ bytes: Buffer.from("x"), altText: "   " }),
    ).rejects.toBeInstanceOf(MediaValidationError);

    await expect(
      validateProductMedia({
        bytes: Buffer.alloc(10 * 1024 * 1024 + 1),
        altText: "Oversized",
      }),
    ).rejects.toBeInstanceOf(MediaValidationError);
  });
});
