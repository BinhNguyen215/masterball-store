import { describe, expect, it } from "vitest";

import {
  parseRecentlyViewedSlugs,
  RECENTLY_VIEWED_LIMIT,
  rememberViewedSlug,
  serializeRecentlyViewedSlugs,
} from "@/components/storefront/recently-viewed";

describe("recently viewed cookie value", () => {
  it("reads valid slugs in the stored order", () => {
    expect(parseRecentlyViewedSlugs("charizard-ex.surging-sparks")).toEqual([
      "charizard-ex",
      "surging-sparks",
    ]);
  });

  it("drops hostile entries instead of trusting the cookie", () => {
    const value = [
      "",
      "   ",
      "BOOSTER-BOX",
      "<script>alert(1)</script>",
      `${"a".repeat(200)}-slug`,
      "booster box",
      "surging-sparks",
      "surging-sparks",
    ].join(".");

    expect(parseRecentlyViewedSlugs(value)).toEqual([
      "booster-box",
      "surging-sparks",
    ]);
  });

  it("ignores values that are not strings and empty cookies", () => {
    expect(parseRecentlyViewedSlugs(undefined)).toEqual([]);
    expect(parseRecentlyViewedSlugs("")).toEqual([]);
    expect(parseRecentlyViewedSlugs(42)).toEqual([]);
  });

  it("bounds the stored list", () => {
    const value = Array.from({ length: RECENTLY_VIEWED_LIMIT + 5 }, (_item, index) => `product-${index}`).join(".");

    expect(parseRecentlyViewedSlugs(value)).toHaveLength(RECENTLY_VIEWED_LIMIT);
  });

  it("moves a repeated view to the front without duplicating it", () => {
    expect(
      rememberViewedSlug(["first", "second", "third"], "second"),
    ).toEqual(["second", "first", "third"]);
  });

  it("keeps the existing list when the recorded slug is not a slug", () => {
    expect(rememberViewedSlug(["first", 7, "Second"], "not a slug")).toEqual([
      "first",
      "second",
    ]);
  });

  it("caps the list when a new view arrives at the limit", () => {
    const existing = Array.from(
      { length: RECENTLY_VIEWED_LIMIT },
      (_item, index) => `product-${index}`,
    );

    const next = rememberViewedSlug(existing, "newest-product");

    expect(next).toHaveLength(RECENTLY_VIEWED_LIMIT);
    expect(next[0]).toBe("newest-product");
    expect(next).not.toContain(`product-${RECENTLY_VIEWED_LIMIT - 1}`);
  });

  it("round-trips through the serialized cookie value", () => {
    const slugs = rememberViewedSlug(["first", "second"], "third");

    expect(parseRecentlyViewedSlugs(serializeRecentlyViewedSlugs(slugs))).toEqual(slugs);
  });
});
