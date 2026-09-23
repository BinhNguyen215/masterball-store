import { afterEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

import { getCartCookieOptions } from "@/app/(store)/cart/cart-cookie";
import {
  getCartPageMessage,
  isCheckoutReady,
  mapCartItems,
  parseRemoveCartForm,
  parseUpdateCartForm,
  type CartSnapshot,
} from "@/app/(store)/cart/cart-commerce";
import {
  createCheckoutIdempotencyKey,
  parseCheckoutForm,
} from "@/app/(store)/checkout/checkout-commerce";
import { getVietnamShippingFee, orderStatusUrl } from "@/modules/checkout";
import { getStorefrontCopy } from "@/i18n";
import {
  isValidOrderLookupToken,
  mapOrderForStorefront,
} from "@/app/(store)/orders/order-commerce";
import {
  createOrderAccessToken,
  normalizeOrderLookupPhone,
  verifyOrderAccessToken,
} from "@/modules/orders";
import {
  getAddedCartQuantity,
  parseAddToCartForm,
} from "@/app/(store)/products/[slug]/product-commerce";

const variantId = "11111111-1111-4111-8111-111111111111";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("storefront cart cookie", () => {
  it("is inaccessible to JavaScript, SameSite=Lax, and secure in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    const expires = new Date("2099-01-01T00:00:00.000Z");

    expect(getCartCookieOptions(expires)).toEqual({
      expires,
      httpOnly: true,
      path: "/",
      sameSite: "lax",
      secure: true,
    });
  });
});

describe("storefront cart input and mapping", () => {
  it("accepts bounded integer quantities and positive cart versions", () => {
    const update = new FormData();
    update.set("variantId", variantId);
    update.set("quantity", "3");
    update.set("expectedVersion", "4");

    expect(parseUpdateCartForm(update)).toEqual({
      expectedVersion: 4,
      quantity: 3,
      variantId,
    });

    const remove = new FormData();
    remove.set("variantId", variantId);
    remove.set("expectedVersion", "4");
    expect(parseRemoveCartForm(remove)).toEqual({
      expectedVersion: 4,
      variantId,
    });
  });

  it("rejects malformed identifiers, fractions, and excessive quantities", () => {
    const update = new FormData();
    update.set("variantId", "not-a-uuid");
    update.set("quantity", "1.5");
    update.set("expectedVersion", "0");

    expect(() => parseUpdateCartForm(update)).toThrow();

    const add = new FormData();
    add.set("variantId", variantId);
    add.set("quantity", "100");
    expect(() => parseAddToCartForm(add)).toThrow();
    expect(() => getAddedCartQuantity(98, 2)).toThrow();
  });

  it("uses current server prices and explains both price and stock changes", () => {
    const snapshot: CartSnapshot = {
      expiresAt: new Date("2099-01-01T00:00:00.000Z"),
      items: [
        {
          available: 1,
          currentPriceVnd: 120_000,
          priceAtAddVnd: 100_000,
          priceChanged: true,
          productSlug: "sample-card",
          productTitle: "Sample card",
          quantity: 2,
          sku: "SKU-01",
          stockChanged: true,
          variantId,
        },
      ],
      status: "ACTIVE",
      subtotalVnd: 240_000,
      version: 2,
    };

    expect(mapCartItems(snapshot, "vi")[0]).toMatchObject({
      unitPriceVnd: 120_000,
      warning: expect.stringContaining("Hiện chỉ còn 1 sản phẩm"),
    });
    expect(mapCartItems(snapshot, "vi")[0]?.warning).toContain("Giá đã đổi");
    expect(isCheckoutReady(snapshot)).toBe(false);
    expect(getCartPageMessage({ error: "changed" }, "vi")?.kind).toBe("error");
  });
});

describe("storefront checkout input and policy", () => {
  function checkoutForm(overrides: Record<string, string> = {}) {
    const form = new FormData();
    form.set("recipientName", "Nguyễn Minh Anh");
    form.set("phone", "0901 234 567");
    form.set("email", "");
    form.set("line1", "12 Nguyễn Huệ");
    form.set("line2", "");
    form.set("ward", "Bến Nghé");
    form.set("district", "Quận 1");
    form.set("province", "TP. Hồ Chí Minh");
    form.set("customerNote", "");
    form.set("paymentMethod", "VNPAY");
    form.set("cartVersion", "7");
    form.set("acceptTerms", "on");
    for (const [key, value] of Object.entries(overrides)) form.set(key, value);
    return form;
  }

  it("parses the address, optional fields, payment method, and reviewed version", () => {
    expect(parseCheckoutForm(checkoutForm())).toEqual({
      acceptTerms: true,
      address: {
        district: "Quận 1",
        line1: "12 Nguyễn Huệ",
        phone: "0901 234 567",
        province: "TP. Hồ Chí Minh",
        recipientName: "Nguyễn Minh Anh",
        ward: "Bến Nghé",
      },
      cartVersion: 7,
      paymentMethod: "VNPAY",
    });
  });

  it("rejects a checkout submitted without terms acceptance", () => {
    const form = checkoutForm();
    form.delete("acceptTerms");

    expect(() => parseCheckoutForm(form)).toThrow(ZodError);
    expect(() => parseCheckoutForm(checkoutForm({ acceptTerms: "" }))).toThrow(
      ZodError,
    );
  });

  it("charges the documented fixed regional fee", () => {
    expect(getVietnamShippingFee({ province: "Thành phố Hồ Chí Minh" })).toBe(
      30_000,
    );
    expect(getVietnamShippingFee({ province: "TP.HCM" })).toBe(30_000);
    expect(getVietnamShippingFee({ province: "Đà Nẵng" })).toBe(40_000);
  });

  it("derives an opaque stable idempotency key on the server boundary", () => {
    const token = "opaque.signed-token";
    const first = createCheckoutIdempotencyKey(token, 3);

    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).toBe(createCheckoutIdempotencyKey(token, 3));
    expect(first).not.toBe(createCheckoutIdempotencyKey(token, 4));
    expect(first).not.toContain(token);
  });

  it("links the confirmation email to the public order page or omits the link", () => {
    vi.stubEnv("APP_URL", "https://store.example.com/");
    expect(orderStatusUrl("lookup-token")).toBe(
      "https://store.example.com/orders/lookup-token",
    );

    vi.stubEnv("APP_URL", "");
    expect(orderStatusUrl("lookup-token")).toBeNull();
  });
});

describe("storefront order lookup mapping", () => {
  it("accepts only the high-entropy lookup token shape", () => {
    expect(isValidOrderLookupToken("A".repeat(43))).toBe(true);
    expect(isValidOrderLookupToken("short")).toBe(false);
    expect(isValidOrderLookupToken(`${"A".repeat(42)}.`)).toBe(false);
  });

  it("maps non-PII order fields and line items", () => {
    const source = {
      address: { phone: "0900000000" },
      createdAt: new Date("2026-09-14T12:00:00.000Z"),
      fulfillmentStatus: "PROCESSING",
      items: [
        {
          id: "line-1",
          lineTotalVnd: 200_000,
          productTitle: "Sample card",
          quantity: 2,
          unitPriceVnd: 100_000,
          variantSku: "SKU-01",
        },
      ],
      orderNumber: "MB-EXAMPLE",
      orderStatus: "CONFIRMED",
      paymentMethod: "COD",
      paymentStatus: "UNPAID",
      shippingVnd: 30_000,
      subtotalVnd: 200_000,
      totalVnd: 230_000,
    };

    const mapped = mapOrderForStorefront(source, getStorefrontCopy("vi").orders);
    expect(mapped).toMatchObject({
      fulfillmentStatusLabel: "Đang chuẩn bị hàng",
      paymentMethodLabel: "Thanh toán khi nhận hàng",
      reference: "MB-EXAMPLE",
      totalVnd: 230_000,
    });
    expect(mapped.items[0]).toMatchObject({
      lineTotalVnd: 200_000,
      productName: "Sample card",
      variantLabel: "SKU-01",
    });
    expect(mapped).not.toHaveProperty("address");
  });

  it("compares Vietnamese phone numbers in one national format", () => {
    expect(normalizeOrderLookupPhone("+84 901 234 567")).toBe("0901234567");
    expect(normalizeOrderLookupPhone("84-901-234-567")).toBe("0901234567");
    expect(normalizeOrderLookupPhone("0901 234 567")).toBe("0901234567");
    expect(normalizeOrderLookupPhone("(090) 123 4567")).toBe("0901234567");
  });

  it("keeps verified order access short-lived and tamper-evident", () => {
    vi.stubEnv("ORDER_LOOKUP_SECRET", "order-lookup-secret-with-32-characters");
    const orderId = "11111111-1111-4111-8111-111111111111";
    const issuedAt = new Date("2026-09-23T10:00:00.000Z");
    const token = createOrderAccessToken(orderId, { now: issuedAt, ttlMs: 60_000 });

    expect(
      verifyOrderAccessToken(token, new Date("2026-09-23T10:00:30.000Z")),
    ).toEqual({ orderId });
    expect(
      verifyOrderAccessToken(token, new Date("2026-09-23T10:05:00.000Z")),
    ).toBeNull();
    expect(verifyOrderAccessToken("not-a-token", issuedAt)).toBeNull();
    expect(
      verifyOrderAccessToken(`${token.slice(0, -1)}A`, issuedAt),
    ).toBeNull();
    expect(
      verifyOrderAccessToken(
        token.replace("11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"),
        issuedAt,
      ),
    ).toBeNull();
  });
});
