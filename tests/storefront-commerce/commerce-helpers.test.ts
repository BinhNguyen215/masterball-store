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
  getCheckoutPageMessage,
  parseCheckoutForm,
  toCheckoutOrderInput,
} from "@/app/(store)/checkout/checkout-commerce";
import { getVietnamShippingFee, orderStatusUrl } from "@/modules/checkout";
import { getStorefrontCopy } from "@/i18n";
import {
  buildOrderStatusExtras,
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
      fulfillment: "DELIVERY",
      paymentMethod: "VNPAY",
    });
  });

  it("accepts the pickup choice without a street address", () => {
    const form = checkoutForm({ fulfillment: "PICKUP" });
    for (const field of ["line1", "line2", "ward", "district", "province"]) {
      form.delete(field);
    }

    expect(parseCheckoutForm(form)).toEqual({
      acceptTerms: true,
      address: {
        phone: "0901 234 567",
        recipientName: "Nguyễn Minh Anh",
      },
      cartVersion: 7,
      fulfillment: "PICKUP",
      paymentMethod: "VNPAY",
    });
  });

  it("still requires the delivery address for a home delivery order", () => {
    const form = checkoutForm();
    form.delete("district");

    expect(() => parseCheckoutForm(form)).toThrow(ZodError);
  });

  it("accepts a bank transfer payment method and rejects an unknown one", () => {
    expect(
      parseCheckoutForm(checkoutForm({ paymentMethod: "BANK_TRANSFER" })).paymentMethod,
    ).toBe("BANK_TRANSFER");
    expect(() => parseCheckoutForm(checkoutForm({ paymentMethod: "CASH" }))).toThrow(
      ZodError,
    );
  });

  it("narrows the parsed form into the checkout service input", () => {
    const identity = { cartToken: "cart-token", idempotencyKey: "idempotency-key" };
    const delivery = toCheckoutOrderInput(
      parseCheckoutForm(checkoutForm({ customerNote: "Giao giờ hành chính" })),
      identity,
    );
    const pickupForm = checkoutForm({ fulfillment: "PICKUP", paymentMethod: "BANK_TRANSFER" });
    for (const field of ["line1", "district", "province"]) pickupForm.delete(field);
    const pickup = toCheckoutOrderInput(parseCheckoutForm(pickupForm), identity);

    expect(delivery).toMatchObject({
      cartToken: "cart-token",
      customerNote: "Giao giờ hành chính",
      fulfillment: "DELIVERY",
      idempotencyKey: "idempotency-key",
      paymentMethod: "VNPAY",
    });
    expect(pickup).toEqual({
      address: { phone: "0901 234 567", recipientName: "Nguyễn Minh Anh" },
      cartToken: "cart-token",
      cartVersion: 7,
      fulfillment: "PICKUP",
      idempotencyKey: "idempotency-key",
      paymentMethod: "BANK_TRANSFER",
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

  it("resolves a localized message when a cart or checkout mutation is throttled", () => {
    const viCart = getCartPageMessage({ error: "throttled" }, "vi");
    const enCart = getCartPageMessage({ error: "throttled" }, "en");
    const viCheckout = getCheckoutPageMessage({ error: "throttled" }, "vi");
    const enCheckout = getCheckoutPageMessage({ error: "throttled" }, "en");

    expect([viCart?.kind, viCheckout?.kind]).toEqual(["error", "error"]);
    expect(viCart?.text).toBeTruthy();
    expect(viCheckout?.text).toBeTruthy();
    expect(viCart?.text).not.toBe(enCart?.text);
    expect(viCheckout?.text).not.toBe(enCheckout?.text);
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
      discountVnd: 0,
      shippingVnd: 30_000,
      subtotalVnd: 200_000,
      totalVnd: 230_000,
      trackingNumber: null,
    };

    const mapped = mapOrderForStorefront(source, getStorefrontCopy("vi").orders);
    expect(mapped).toMatchObject({
      fulfillmentStatusLabel: "Đang chuẩn bị hàng",
      paymentMethodLabel: "Thanh toán khi nhận hàng",
      reference: "MB-EXAMPLE",
      timeline: [],
      totalVnd: 230_000,
      trackingNumber: null,
    });
    expect(mapped.items[0]).toMatchObject({
      lineTotalVnd: 200_000,
      productName: "Sample card",
      variantLabel: "SKU-01",
    });
    expect(mapped).not.toHaveProperty("address");
  });

  const shipmentSource = {
    createdAt: new Date("2026-09-14T03:00:00.000Z"),
    fulfillmentStatus: "SHIPPED",
    items: [],
    orderNumber: "MB-SHIPPED",
    orderStatus: "CONFIRMED",
    paymentMethod: "COD",
    paymentStatus: "UNPAID",
    discountVnd: 0,
    shippingVnd: 30_000,
    subtotalVnd: 0,
    totalVnd: 30_000,
    trackingNumber: "VN-123456789",
  };

  function historyEntry(
    id: string,
    dimension: string,
    toStatus: string,
    at: string,
  ) {
    return { createdAt: new Date(at), dimension, id, toStatus };
  }

  it("surfaces the shipment state and a readable status timeline", () => {
    const mapped = mapOrderForStorefront(
      shipmentSource,
      getStorefrontCopy("vi").orders,
      [
        historyEntry("h-1", "ORDER", "PENDING_PAYMENT", "2026-09-14T03:00:00.000Z"),
        historyEntry("h-2", "ORDER", "CONFIRMED", "2026-09-14T04:00:00.000Z"),
        historyEntry("h-3", "FULFILLMENT", "PROCESSING", "2026-09-15T01:00:00.000Z"),
        historyEntry("h-4", "FULFILLMENT", "SHIPPED", "2026-09-16T01:00:00.000Z"),
      ],
    );

    expect(mapped.fulfillmentStatusLabel).toBe("Đang giao");
    expect(mapped.trackingNumber).toBe("VN-123456789");
    expect(
      mapped.timeline.map((entry) => [entry.dimensionLabel, entry.statusLabel]),
    ).toEqual([
      ["Đơn hàng", "Đang chờ thanh toán"],
      ["Đơn hàng", "Đã xác nhận"],
      ["Giao hàng", "Đang chuẩn bị hàng"],
      ["Giao hàng", "Đang giao"],
    ]);
    expect(mapped.timeline[0].createdAt).toBe("2026-09-14T03:00:00.000Z");
    expect(mapped.timeline[3]).not.toHaveProperty("reason");
    expect(mapped.timeline[3]).not.toHaveProperty("actorId");
  });

  it("translates the shipment state and timeline for the English storefront", () => {
    const mapped = mapOrderForStorefront(
      shipmentSource,
      getStorefrontCopy("en").orders,
      [historyEntry("h-1", "FULFILLMENT", "DELIVERED", "2026-09-17T01:00:00.000Z")],
    );

    expect(mapped.fulfillmentStatusLabel).toBe("Shipped");
    expect(mapped.timeline).toEqual([
      {
        createdAt: "2026-09-17T01:00:00.000Z",
        dimensionLabel: "Fulfilment",
        id: "h-1",
        statusLabel: "Delivered",
      },
    ]);
  });

  it("keeps the newest twenty timeline entries and drops payment-only history", () => {
    const history = Array.from({ length: 25 }, (_, index) =>
      historyEntry(
        `h-${index}`,
        "FULFILLMENT",
        "PROCESSING",
        `2026-09-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`,
      ),
    );
    const withPayment = [
      historyEntry("payment-1", "PAYMENT", "PAID", "2026-09-13T00:00:00.000Z"),
      ...history,
    ];

    const mapped = mapOrderForStorefront(
      shipmentSource,
      getStorefrontCopy("vi").orders,
      withPayment,
    );

    expect(mapped.timeline).toHaveLength(20);
    expect(mapped.timeline.map((entry) => entry.id)).not.toContain("payment-1");
    expect(mapped.timeline[0].id).toBe("h-5");
    expect(mapped.timeline[19].id).toBe("h-24");
  });

  it("prefers no tracking number over a blank one", () => {
    const mapped = mapOrderForStorefront(
      { ...shipmentSource, trackingNumber: "   " },
      getStorefrontCopy("vi").orders,
    );

    expect(mapped.trackingNumber).toBeNull();
  });

  it("names the bank transfer method in both storefront languages", () => {
    expect(
      mapOrderForStorefront(
        { ...shipmentSource, paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING" },
        getStorefrontCopy("vi").orders,
      ).paymentMethodLabel,
    ).toBe("Chuyển khoản ngân hàng");
    expect(
      mapOrderForStorefront(
        { ...shipmentSource, paymentMethod: "BANK_TRANSFER", paymentStatus: "PENDING" },
        getStorefrontCopy("en").orders,
      ).paymentMethodLabel,
    ).toBe("Bank transfer");
  });

  it("shows transfer details only while a bank transfer still awaits payment", () => {
    const config = {
      accountName: "NGUYEN VAN A",
      accountNo: "0123456789",
      bankId: "970436",
    };
    const awaiting = buildOrderStatusExtras({
      bankTransferConfig: config,
      order: {
        customerNote: null,
        orderNumber: "MB-1CD39059E3D48C785FAD",
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PENDING",
        totalVnd: 230_000,
      },
      pickupLocation: null,
    });

    expect(awaiting.bankTransfer).toMatchObject({
      accountNo: "0123456789",
      amountVnd: 230_000,
      transferContent: "MB-1CD39059E3D48C785FAD",
      qrImageUrl: expect.stringContaining(
        "https://img.vietqr.io/image/970436-0123456789-compact2.png?amount=230000&addInfo=MB-1CD39059E3D48C785FAD",
      ),
    });
    expect(awaiting.pickup).toBeNull();

    const settled = buildOrderStatusExtras({
      bankTransferConfig: config,
      order: {
        customerNote: null,
        orderNumber: "MB-1CD39059E3D48C785FAD",
        paymentMethod: "BANK_TRANSFER",
        paymentStatus: "PAID",
        totalVnd: 230_000,
      },
      pickupLocation: null,
    });
    const codOrder = buildOrderStatusExtras({
      bankTransferConfig: config,
      order: {
        customerNote: null,
        orderNumber: "MB-1CD39059E3D48C785FAD",
        paymentMethod: "COD",
        paymentStatus: "UNPAID",
        totalVnd: 230_000,
      },
      pickupLocation: null,
    });

    expect(settled.bankTransfer).toBeNull();
    expect(codOrder.bankTransfer).toBeNull();
  });

  it("shows the shop address only for an order that is collected there", () => {
    const pickupLocation = { address: "12 Nguyễn Huệ, Quận 1", storeName: "MasterBall Store" };
    const base = {
      bankTransferConfig: null,
      order: {
        orderNumber: "MB-1CD39059E3D48C785FAD",
        paymentMethod: "COD",
        paymentStatus: "UNPAID",
        totalVnd: 230_000,
      },
      pickupLocation,
    };

    expect(
      buildOrderStatusExtras({
        ...base,
        order: { ...base.order, customerNote: "[PICKUP] Gọi trước khi tới" },
      }).pickup,
    ).toEqual(pickupLocation);
    expect(
      buildOrderStatusExtras({
        ...base,
        order: { ...base.order, customerNote: "Giao giờ hành chính" },
      }).pickup,
    ).toBeNull();
    expect(
      buildOrderStatusExtras({
        ...base,
        order: { ...base.order, customerNote: "[PICKUP]" },
        pickupLocation: null,
      }).pickup,
    ).toBeNull();
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
