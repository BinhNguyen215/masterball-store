// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ProductPurchaseForm } from "@/components/storefront/product-purchase-form";
import { ProductReviews } from "@/components/storefront/product-reviews";
import {
  getProductReviewMessage,
  getRestockMessage,
  readProductReviewForm,
  readRestockAlertForm,
} from "@/app/(store)/products/[slug]/product-commerce";
import { formatCopy, getStorefrontCopy } from "@/i18n";
import { isValidReviewRating } from "@/modules/reviews";

const vi = getStorefrontCopy("vi");
const en = getStorefrontCopy("en");
const noop = async () => {};

describe("product review notices", () => {
  it("renders the pending notice for a recorded review in both locales", () => {
    expect(getProductReviewMessage({ review: "recorded" }, vi.reviews)).toEqual({
      kind: "success",
      text: vi.reviews.pendingNotice,
    });
    expect(getProductReviewMessage({ review: "recorded" }, en.reviews)).toEqual({
      kind: "success",
      text: en.reviews.pendingNotice,
    });
  });

  it("maps every failure code to its localized error message", () => {
    const expected: Record<string, string> = {
      duplicate: vi.reviews.errors.duplicate,
      invalid: vi.reviews.errors.invalid,
      notfound: vi.reviews.errors.notFound,
      service: vi.reviews.errors.service,
      throttled: vi.reviews.errors.throttled,
    };

    for (const [code, text] of Object.entries(expected)) {
      expect(getProductReviewMessage({ review: code }, vi.reviews)).toEqual({
        kind: "error",
        text,
      });
    }
    expect(
      getProductReviewMessage({ review: "notfound" }, en.reviews)?.text,
    ).toBe(en.reviews.errors.notFound);
  });

  it("renders no notice for an absent or unrecognised code", () => {
    expect(getProductReviewMessage({}, vi.reviews)).toBeUndefined();
    expect(getProductReviewMessage({ review: "tampered" }, vi.reviews)).toBeUndefined();
    expect(getProductReviewMessage({ review: [] }, vi.reviews)).toBeUndefined();
  });

  it("reads the first value of a repeated review key", () => {
    expect(
      getProductReviewMessage({ review: ["recorded", "tampered"] }, vi.reviews)
        ?.text,
    ).toBe(vi.reviews.pendingNotice);
  });
});

describe("restock notices", () => {
  it("separates a fresh subscription from an already-registered address", () => {
    expect(getRestockMessage({ restock: "recorded" }, vi.restock)).toEqual({
      kind: "success",
      text: vi.restock.successNotice,
    });
    expect(getRestockMessage({ restock: "existing" }, en.restock)).toEqual({
      kind: "success",
      text: en.restock.alreadyNotice,
    });
  });

  it("maps every failure code to its localized error message", () => {
    const expected: Record<string, string> = {
      invalid: vi.restock.errors.invalid,
      service: vi.restock.errors.service,
      throttled: vi.restock.errors.throttled,
      unavailable: vi.restock.errors.unavailable,
    };

    for (const [code, text] of Object.entries(expected)) {
      expect(getRestockMessage({ restock: code }, vi.restock)).toEqual({
        kind: "error",
        text,
      });
    }
    expect(getRestockMessage({ restock: "unavailable" }, en.restock)?.text).toBe(
      en.restock.errors.unavailable,
    );
  });

  it("renders no notice for an absent or unrecognised code", () => {
    expect(getRestockMessage({}, vi.restock)).toBeUndefined();
    expect(getRestockMessage({ restock: "tampered" }, vi.restock)).toBeUndefined();
  });
});

describe("product engagement form readers", () => {
  it("reads the review fields and coerces the rating to a number", () => {
    const formData = new FormData();
    formData.set("authorName", "Lan");
    formData.set("body", "Great card, fast shipping.");
    formData.set("orderNumber", "MB-1001");
    formData.set("phone", "0900000000");
    formData.set("rating", "4");

    expect(readProductReviewForm(formData)).toEqual({
      authorName: "Lan",
      body: "Great card, fast shipping.",
      orderNumber: "MB-1001",
      phone: "0900000000",
      rating: 4,
    });
  });

  it("never fabricates a valid rating when the field is missing or malformed", () => {
    expect(isValidReviewRating(readProductReviewForm(new FormData()).rating)).toBe(
      false,
    );
    const blank = new FormData();
    blank.set("rating", "");
    expect(isValidReviewRating(readProductReviewForm(blank).rating)).toBe(false);
    const junk = new FormData();
    junk.set("rating", "not-a-number");
    expect(isValidReviewRating(readProductReviewForm(junk).rating)).toBe(false);
  });

  it("reads the restock email and variant id as posted", () => {
    const formData = new FormData();
    formData.set("email", "buyer@example.com");
    formData.set("variantId", "11111111-1111-4111-8111-111111111111");

    expect(readRestockAlertForm(formData)).toEqual({
      email: "buyer@example.com",
      variantId: "11111111-1111-4111-8111-111111111111",
    });
    expect(readRestockAlertForm(new FormData())).toEqual({
      email: "",
      variantId: "",
    });
  });
});

afterEach(cleanup);

const emptyReviews = { averageRating: null, items: [], reviewCount: 0 };
const publishedReviews = {
  averageRating: 4.5,
  reviewCount: 12,
  items: [
    {
      authorName: "Lan",
      body: "Great card, fast shipping.",
      id: "review-1",
      publishedAt: "2026-01-02T03:04:05.000Z",
      rating: 5,
    },
    {
      authorName: "Minh",
      body: "Second copy, still sealed.",
      id: "review-2",
      publishedAt: "2026-01-03T03:04:05.000Z",
      rating: 4,
    },
  ],
};

describe("ProductReviews rendering", () => {
  it("shows the explicit empty state and the form in Vietnamese", () => {
    render(
      createElement(ProductReviews, {
        action: noop,
        copy: vi.reviews,
        locale: "vi",
        reviews: emptyReviews,
      }),
    );

    expect(screen.getByText(vi.reviews.empty)).toBeTruthy();
    expect(screen.getByText(vi.reviews.formTitle)).toBeTruthy();
    expect(screen.getByLabelText(vi.reviews.formName)).toBeTruthy();
    expect(screen.getByLabelText(vi.reviews.formOrderNumber)).toBeTruthy();
    expect(screen.getByLabelText(vi.reviews.formPhone)).toBeTruthy();
    expect(screen.getByLabelText(vi.reviews.formRating)).toBeTruthy();
    expect(screen.getByLabelText(vi.reviews.formBody)).toBeTruthy();
  });

  it("shows the same empty state and form in English", () => {
    render(
      createElement(ProductReviews, {
        action: noop,
        copy: en.reviews,
        locale: "en",
        reviews: emptyReviews,
      }),
    );

    expect(screen.getByText(en.reviews.empty)).toBeTruthy();
    expect(screen.getByText(en.reviews.formTitle)).toBeTruthy();
  });

  it("shows the average, the count, every published review and the verified marker", () => {
    render(
      createElement(ProductReviews, {
        action: noop,
        copy: vi.reviews,
        locale: "vi",
        reviews: publishedReviews,
      }),
    );

    expect(screen.queryByText(vi.reviews.empty)).toBeNull();
    expect(screen.getByText("4.5")).toBeTruthy();
    expect(
      screen.getByText(formatCopy(vi.reviews.countLabel, { count: 12 })),
    ).toBeTruthy();
    expect(screen.getByText("Lan")).toBeTruthy();
    expect(screen.getByText("Minh")).toBeTruthy();
    expect(screen.getAllByText(vi.reviews.verified)).toHaveLength(2);
    const ratingValues = Array.from(
      document.querySelectorAll(".review-rating-value"),
    ).map((element) => element.textContent);
    expect(ratingValues).toEqual(["5/5", "4/5"]);
  });

  it("renders the submission notice beside the form", () => {
    render(
      createElement(ProductReviews, {
        action: noop,
        copy: en.reviews,
        locale: "en",
        message: getProductReviewMessage({ review: "recorded" }, en.reviews),
        reviews: emptyReviews,
      }),
    );

    expect(screen.getByText(en.reviews.pendingNotice)).toBeTruthy();
    expect(screen.getByText(en.reviews.formTitle)).toBeTruthy();
  });
});

const variants = [
  { available: true, id: "variant-in", label: "Booster box" },
  { available: false, id: "variant-out", label: "Single pack" },
];

function renderPurchaseForm() {
  return render(
    createElement(ProductPurchaseForm, {
      addToCartAction: noop,
      copy: vi.product,
      restockAction: noop,
      restockCopy: vi.restock,
      variants,
    }),
  );
}

describe("ProductPurchaseForm restock gating", () => {
  it("offers no restock form until an out-of-stock variant is selected", () => {
    renderPurchaseForm();

    expect(screen.queryByText(vi.restock.heading)).toBeNull();
    expect(screen.getByLabelText(vi.product.quantity)).toBeTruthy();
    expect(screen.getByRole("button", { name: vi.product.addToCart })).toBeTruthy();
  });

  it("swaps the add-to-cart fields for the restock form on a dead variant", () => {
    renderPurchaseForm();
    const select = screen.getByLabelText(vi.product.variant);

    fireEvent.change(select, { target: { value: "variant-out" } });

    expect(screen.getByText(vi.restock.heading)).toBeTruthy();
    expect(screen.getByLabelText(vi.restock.fieldEmail)).toBeTruthy();
    expect(screen.queryByLabelText(vi.product.quantity)).toBeNull();
    expect(screen.queryByRole("button", { name: vi.product.addToCart })).toBeNull();

    const posted = document.querySelector<HTMLInputElement>(
      'input[type="hidden"][name="variantId"]',
    );
    expect(posted?.value).toBe("variant-out");
  });

  it("restores the add-to-cart fields when a sellable variant is selected again", () => {
    renderPurchaseForm();
    const select = screen.getByLabelText(vi.product.variant);

    fireEvent.change(select, { target: { value: "variant-out" } });
    expect(screen.getByText(vi.restock.heading)).toBeTruthy();

    fireEvent.change(select, { target: { value: "variant-in" } });
    expect(screen.queryByText(vi.restock.heading)).toBeNull();
    expect(screen.getByLabelText(vi.product.quantity)).toBeTruthy();
    expect(screen.getByRole("button", { name: vi.product.addToCart })).toBeTruthy();
  });

  it("keeps an out-of-stock option selectable so the alert can be reached", () => {
    renderPurchaseForm();
    const option = screen
      .getByLabelText(vi.product.variant)
      .querySelector<HTMLOptionElement>('option[value="variant-out"]');

    expect(option?.disabled).toBe(false);
    expect(option?.textContent).toContain(vi.product.variantOutOfStockSuffix);
  });

  it("renders the restock section in English too", () => {
    render(
      createElement(ProductPurchaseForm, {
        addToCartAction: noop,
        copy: en.product,
        restockAction: noop,
        restockCopy: en.restock,
        variants,
      }),
    );

    fireEvent.change(screen.getByLabelText(en.product.variant), {
      target: { value: "variant-out" },
    });

    expect(screen.getByText(en.restock.heading)).toBeTruthy();
    expect(screen.getByLabelText(en.restock.fieldEmail)).toBeTruthy();
  });
});
