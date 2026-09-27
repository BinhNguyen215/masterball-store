import { describe, expect, it } from "vitest";

import {
  isValidRestockEmail,
  normalizeRestockEmail,
  RestockAlertError,
  subscribeToRestock,
} from "@/modules/inventory";
import {
  getProductReviewSummary,
  isValidReviewAuthorName,
  isValidReviewBody,
  isValidReviewRating,
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_BODY_MIN_LENGTH,
  ReviewError,
  submitProductReview,
} from "@/modules/reviews";

describe("review submission rules", () => {
  it("accepts only whole ratings between 1 and 5", () => {
    for (const rating of [1, 2, 3, 4, 5]) {
      expect(isValidReviewRating(rating)).toBe(true);
    }
    for (const rating of [0, 6, -1, 3.5, Number.NaN, "4", null, undefined]) {
      expect(isValidReviewRating(rating)).toBe(false);
    }
  });

  it("measures the body after trimming, between 10 and 2000 characters", () => {
    const longest = "a".repeat(REVIEW_BODY_MAX_LENGTH);
    expect(isValidReviewBody("a".repeat(REVIEW_BODY_MIN_LENGTH))).toBe(true);
    expect(isValidReviewBody(longest)).toBe(true);
    expect(isValidReviewBody(`  ${longest}  `)).toBe(true);

    expect(isValidReviewBody("a".repeat(REVIEW_BODY_MIN_LENGTH - 1))).toBe(false);
    expect(isValidReviewBody("a".repeat(REVIEW_BODY_MAX_LENGTH + 1))).toBe(false);
    expect(isValidReviewBody("   short   ")).toBe(false);
  });

  it("requires a display name between 2 and 120 characters", () => {
    expect(isValidReviewAuthorName("An")).toBe(true);
    expect(isValidReviewAuthorName("  Nguyễn Văn An  ")).toBe(true);
    expect(isValidReviewAuthorName("a".repeat(120))).toBe(true);
    expect(isValidReviewAuthorName("A")).toBe(false);
    expect(isValidReviewAuthorName("a".repeat(121))).toBe(false);
    expect(isValidReviewAuthorName("   ")).toBe(false);
  });

  it("rejects an invalid submission before any order lookup happens", async () => {
    await expect(
      submitProductReview({
        productId: "not-a-uuid",
        orderNumber: "MB-0000000000000000000",
        phone: "0901234567",
        authorName: "An",
        rating: 6,
        body: "too short",
      }),
    ).rejects.toMatchObject({ name: "ReviewError", code: "INVALID" });
  });

  it("answers a malformed product identifier with an empty summary, not a query", async () => {
    await expect(getProductReviewSummary("not-a-uuid")).resolves.toEqual({
      averageRating: null,
      reviewCount: 0,
    });
  });
});

describe("restock alert email rules", () => {
  it("lower-cases and trims every address before it is stored", () => {
    expect(normalizeRestockEmail("  Buyer@Example.COM ")).toBe("buyer@example.com");
    expect(normalizeRestockEmail("buyer@example.com")).toBe("buyer@example.com");
  });

  it("accepts ordinary addresses and rejects malformed ones", () => {
    for (const email of [
      "buyer@example.com",
      "a.b+tag@sub.example.co",
      "  Buyer@Example.COM ",
    ]) {
      expect(isValidRestockEmail(email)).toBe(true);
    }
    for (const email of [
      "",
      "   ",
      "buyer",
      "buyer@example",
      "buyer@ example.com",
      "buyer@@example.com",
      "buyer@example.",
      `${"a".repeat(250)}@example.com`,
    ]) {
      expect(isValidRestockEmail(email)).toBe(false);
    }
  });

  it("refuses a malformed address without opening a transaction", async () => {
    await expect(
      subscribeToRestock({ variantId: "not-a-uuid", email: "buyer@example" }),
    ).rejects.toBeInstanceOf(RestockAlertError);
  });

  it("exports the typed review failure the console maps to a message", () => {
    expect(new ReviewError("nope", "DUPLICATE").code).toBe("DUPLICATE");
  });
});
