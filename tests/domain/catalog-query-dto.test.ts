import { describe, expect, it } from "vitest";

import { parseStorefrontProductQuery } from "@/modules/catalog";

describe("storefront catalog query DTO", () => {
  it("parses repeatable shareable filters and applies bounded pagination", () => {
    const params = new URLSearchParams();
    params.append("game", "pokemon");
    params.append("game", "riftbound");
    params.set("type", "SEALED,SINGLE");
    params.set("minPrice", "10000");
    params.set("maxPrice", "500000");
    params.set("availability", "in-stock");
    params.set("sort", "price-asc");

    expect(parseStorefrontProductQuery(params)).toMatchObject({
      game: ["pokemon", "riftbound"],
      type: ["SEALED", "SINGLE"],
      minPrice: 10_000,
      maxPrice: 500_000,
      availability: "in-stock",
      sort: "price-asc",
      page: 1,
      pageSize: 24,
    });
  });

  it("rejects inverted prices and raw sort expressions", () => {
    expect(() => parseStorefrontProductQuery({ minPrice: 20, maxPrice: 10 })).toThrow();
    expect(() => parseStorefrontProductQuery({ sort: "price desc; drop table products" })).toThrow();
  });
});
