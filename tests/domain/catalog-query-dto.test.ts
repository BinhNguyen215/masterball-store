import { describe, expect, it } from "vitest";

import {
  parseStorefrontProductQuery,
  sanitizeStorefrontProductQueryInput,
} from "@/modules/catalog";

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

  it("degrades hostile catalog URLs into a bounded query instead of failing", () => {
    const params = new URLSearchParams();
    params.set("page", "abc");
    params.set("minPrice", "abc");
    params.set("maxPrice", "0.5");
    params.set("sort", "price desc; drop table products");
    params.set("availability", "everything");
    params.set("type", "SEALED,HOLO");
    params.set("q", "x".repeat(180));
    for (let index = 0; index < 40; index += 1) {
      params.append("game", `game-${index}`);
    }

    const query = parseStorefrontProductQuery(
      sanitizeStorefrontProductQueryInput(params),
    );

    expect(query.page).toBe(1);
    expect(query.pageSize).toBe(24);
    expect(query.minPrice).toBeUndefined();
    expect(query.maxPrice).toBeUndefined();
    expect(query.sort).toBe("featured");
    expect(query.availability).toBe("all");
    expect(query.type).toEqual(["SEALED"]);
    expect(query.q).toHaveLength(100);
    expect(query.game).toHaveLength(30);
  });

  it("drops contradictory price bounds once sanitized", () => {
    const query = parseStorefrontProductQuery(
      sanitizeStorefrontProductQueryInput({ minPrice: "500000", maxPrice: "100" }),
    );

    expect(query.minPrice).toBeUndefined();
    expect(query.maxPrice).toBeUndefined();
  });

  it("normalizes tag slugs carried by a shareable catalog URL", () => {
    const params = new URLSearchParams();
    params.append("tag", "Booster-Box");
    params.append("tag", "pre-order");
    params.append("tag", "booster-box");

    expect(
      parseStorefrontProductQuery(sanitizeStorefrontProductQueryInput(params)).tag,
    ).toEqual(["booster-box", "pre-order"]);
  });

  it("degrades hostile tag values into a bounded slug list", () => {
    const params = new URLSearchParams();
    params.set("tag", "Pokemon-151");
    params.append("tag", "  ");
    params.append("tag", "drop table products");
    params.append("tag", "<script>alert(1)</script>");
    params.append("tag", `${"a".repeat(200)}-slug`);
    params.append("tag", "pokemon-151");

    const query = parseStorefrontProductQuery(
      sanitizeStorefrontProductQueryInput(params),
    );

    expect(query.tag).toEqual(["pokemon-151"]);
  });

  it("caps the number of tag filters a hostile URL can carry", () => {
    const params = new URLSearchParams();
    for (let index = 0; index < 40; index += 1) {
      params.append("tag", `tag-${index}`);
    }

    const query = parseStorefrontProductQuery(
      sanitizeStorefrontProductQueryInput(params),
    );

    expect(query.tag).toHaveLength(30);
    expect(query.tag[0]).toBe("tag-0");
  });

  it("never throws on non-string tag input", () => {
    const query = parseStorefrontProductQuery(
      sanitizeStorefrontProductQueryInput({ tag: { evil: true } }),
    );

    expect(query.tag).toEqual([]);
  });
});
