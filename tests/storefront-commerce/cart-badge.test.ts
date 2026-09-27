// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoreNav } from "@/components/storefront/store-nav";
import { getStorefrontCopy } from "@/i18n";

// The nav reads the current path for its active state; the badge does not.
vi.mock("next/navigation", () => ({
  usePathname: () => "/products",
}));

const viCopy = getStorefrontCopy("vi");
const enCopy = getStorefrontCopy("en");

function renderNav(cartItemCount: number, locale: "vi" | "en" = "vi") {
  return render(
    createElement(StoreNav, {
      accountLabel: "Tài khoản",
      cartItemCount,
      copy: (locale === "vi" ? viCopy : enCopy).chrome,
      locale,
      localeSwitcher: null,
      themeSwitch: null,
    }),
  );
}

afterEach(cleanup);

describe("cart badge", () => {
  it("shows no badge and the plain label for an empty cart", () => {
    renderNav(0);

    expect(document.querySelector(".cart-count")).toBeNull();
    expect(screen.getByRole("link", { name: "Mở giỏ hàng" })).toBeTruthy();
  });

  it("shows the unit count on the cart link", () => {
    renderNav(3);

    expect(document.querySelector(".cart-count")?.textContent).toBe("3");
    expect(screen.getByRole("link", { name: "Mở giỏ hàng, 3 sản phẩm" })).toBeTruthy();
  });

  it("uses the singular label for one item in both locales", () => {
    renderNav(1, "en");
    expect(screen.getByRole("link", { name: "Open cart, 1 item" })).toBeTruthy();

    cleanup();
    renderNav(1);
    expect(screen.getByRole("link", { name: "Mở giỏ hàng, 1 sản phẩm" })).toBeTruthy();
  });

  it("caps the visible count so a large cart cannot break the layout", () => {
    renderNav(140);

    expect(document.querySelector(".cart-count")?.textContent).toBe("99+");
    expect(screen.getByRole("link", { name: "Mở giỏ hàng, 140 sản phẩm" })).toBeTruthy();
  });
});
