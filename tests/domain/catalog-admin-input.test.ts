import { describe, expect, it } from "vitest";

import { productMutationSchema } from "@/modules/auth/schemas";

const productId = "11111111-1111-4111-8111-111111111111";
const gameId = "22222222-2222-4222-8222-222222222222";

describe("catalog admin input", () => {
  it("parses a complete product update and server-owned checkbox state", () => {
    expect(
      productMutationSchema.parse({
        operation: "update-product",
        productId,
        version: "3",
        title: "Booster Box",
        slug: "booster-box",
        gameId,
        setId: "",
        type: "SEALED",
        description: "Factory sealed",
        seoTitle: "",
        seoDescription: "",
      }),
    ).toMatchObject({
      featured: false,
      productId,
      setId: null,
      version: 3,
    });
  });

  it("normalizes and validates the complete replacement tag list", () => {
    const secondTag = "33333333-3333-4333-8333-333333333333";
    expect(
      productMutationSchema.parse({
        operation: "replace-tags",
        productId,
        tagIds: `${gameId}, ${secondTag}`,
      }),
    ).toMatchObject({ tagIds: [gameId, secondTag] });

    expect(() =>
      productMutationSchema.parse({
        operation: "replace-tags",
        productId,
        tagIds: "not-a-uuid",
      }),
    ).toThrow();
  });

  it("requires optimistic versions for product and variant updates", () => {
    expect(() =>
      productMutationSchema.parse({
        operation: "update-variant",
        variantId: productId,
        version: "0",
        sku: "SKU-1",
        status: "ACTIVE",
        language: "vi",
        priceVnd: "100000",
        weightGram: "0",
      }),
    ).toThrow();
  });
});
