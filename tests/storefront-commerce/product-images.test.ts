import { describe, expect, it } from "vitest";

import { buildProductImages } from "@/components/storefront/product-images";

const FIRST_KEY = `products/${"a".repeat(48)}.webp`;
const SECOND_KEY = `products/${"b".repeat(48)}.jpg`;
const BASE_URL = "https://cdn.example.com/media";

function asset(objectKey: string, overrides: Partial<{ altText: string; mimeType: string }> = {}) {
  return { altText: "Booster box", mimeType: "image/webp", objectKey, ...overrides };
}

describe("product gallery images", () => {
  it("resolves every image asset in the stored order, primary first", () => {
    const images = buildProductImages(
      [asset(FIRST_KEY), asset(SECOND_KEY, { altText: "Second angle", mimeType: "image/jpeg" })],
      { fallbackAlt: "Product title", publicBaseUrl: BASE_URL },
    );

    expect(images).toEqual([
      { alt: "Booster box", src: `${BASE_URL}/${FIRST_KEY}` },
      { alt: "Second angle", src: `${BASE_URL}/${SECOND_KEY}` },
    ]);
  });

  it("returns no gallery without a usable public base url, so the page keeps its single-image fallback", () => {
    expect(
      buildProductImages([asset(FIRST_KEY)], { fallbackAlt: "Product title" }),
    ).toEqual([]);
    expect(
      buildProductImages([asset(FIRST_KEY)], {
        fallbackAlt: "Product title",
        publicBaseUrl: "  ",
      }),
    ).toEqual([]);
    expect(
      buildProductImages([asset(FIRST_KEY)], {
        fallbackAlt: "Product title",
        publicBaseUrl: "ftp://cdn.example.com",
      }),
    ).toEqual([]);
  });

  it("skips assets that are not images or not owned by the media namespace", () => {
    const images = buildProductImages(
      [
        asset(FIRST_KEY, { mimeType: "application/pdf" }),
        asset("products/not-an-owned-key.webp"),
        asset(SECOND_KEY),
      ],
      { fallbackAlt: "Product title", publicBaseUrl: BASE_URL },
    );

    expect(images).toEqual([{ alt: "Booster box", src: `${BASE_URL}/${SECOND_KEY}` }]);
  });

  it("falls back to the product title when an asset has no alt text", () => {
    const images = buildProductImages([asset(FIRST_KEY, { altText: "   " })], {
      fallbackAlt: "Product title",
      publicBaseUrl: BASE_URL,
    });

    expect(images[0]?.alt).toBe("Product title");
  });
});
