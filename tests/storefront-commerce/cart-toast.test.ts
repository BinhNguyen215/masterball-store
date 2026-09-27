// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CartToast } from "@/components/storefront/cart-toast";
import { getStorefrontCopy } from "@/i18n";

const replace = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/products/sample-card",
  useRouter: () => ({ replace }),
}));

const copy = getStorefrontCopy("vi").chrome;

function renderToast(show: boolean) {
  return render(
    createElement(CartToast, {
      copy,
      message: "Đã thêm sản phẩm vào giỏ hàng.",
      show,
    }),
  );
}

beforeEach(() => {
  replace.mockClear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe("cart toast", () => {
  it("auto-dismisses and clears the redirect flag", () => {
    renderToast(true);
    expect(screen.getByRole("status")).toBeTruthy();

    act(() => {
      vi.advanceTimersByTime(5_000);
    });

    expect(screen.queryByRole("status")).toBeNull();
    expect(replace).toHaveBeenCalledWith("/products/sample-card", { scroll: false });
  });

  it("confirms a second add-to-cart after the first notice was dismissed", () => {
    const view = renderToast(true);
    act(() => {
      vi.advanceTimersByTime(5_000);
    });
    expect(screen.queryByRole("status")).toBeNull();

    // The action strips the flag, then a later add brings it back — the same
    // mounted component has to forget the previous dismissal.
    view.rerender(
      createElement(CartToast, { copy, message: "Đã thêm sản phẩm vào giỏ hàng.", show: false }),
    );
    view.rerender(
      createElement(CartToast, { copy, message: "Đã thêm sản phẩm vào giỏ hàng.", show: true }),
    );

    expect(screen.getByRole("status")).toBeTruthy();
  });
});
