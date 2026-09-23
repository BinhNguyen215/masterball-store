import { createHmac } from "node:crypto";

import { expect, test } from "@playwright/test";

const publicHtmlRoutes = [
  "/",
  "/products",
  "/products/unconfigured-product",
  "/cart",
  "/checkout",
  "/orders/unconfigured-order",
  "/tournaments",
  "/tournaments/unconfigured-tournament",
  "/policies/privacy",
  "/policies/returns",
  "/policies/shipping",
  "/policies/terms",
] as const;

const documentRoutes = ["/robots.txt", "/sitemap.xml"] as const;
const viewports = [
  { width: 360, height: 800 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const;

function signVnpay(params: Record<string, string>, secret: string): string {
  const canonical = Object.entries(params)
    .filter(([key, value]) => key !== "vnp_SecureHash" && value !== "")
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");

  return createHmac("sha512", secret).update(canonical, "utf8").digest("hex");
}

test("all public pages render without console errors or horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(180_000);

  let currentRoute = "initialization";
  const browserErrors: string[] = [];
  const networkErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`${currentRoute}: console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    browserErrors.push(`${currentRoute}: pageerror: ${error.message}`);
  });
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "unknown error";
    const requestUrl = new URL(request.url());
    if (failure === "net::ERR_ABORTED" && requestUrl.searchParams.has("_rsc")) {
      return;
    }
    networkErrors.push(
      `${currentRoute}: request failed: ${request.method()} ${request.url()} (${failure})`,
    );
  });
  page.on("response", (response) => {
    if (response.status() >= 400) {
      networkErrors.push(
        `${currentRoute}: HTTP ${response.status()}: ${response.request().method()} ${response.url()}`,
      );
    }
  });

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);

    for (const route of publicHtmlRoutes) {
      currentRoute = `${route} at ${viewport.width}px`;
      const response = await page.goto(route, { waitUntil: "domcontentloaded" });

      expect(response?.status(), currentRoute).toBe(200);
      await expect(page.locator("header.site-header"), currentRoute).toHaveCount(1);
      await expect(page.locator("main#main-content"), currentRoute).toHaveCount(1);
      await expect(page.locator("footer"), currentRoute).toHaveCount(1);
      await expect(page.getByRole("heading").first(), currentRoute).toBeVisible();

      const geometry = await page.evaluate(() => ({
        clientWidth: document.documentElement.clientWidth,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      expect(geometry.scrollWidth, currentRoute).toBeLessThanOrEqual(
        geometry.clientWidth,
      );
    }
  }

  expect(browserErrors).toEqual([]);
  expect(networkErrors).toEqual([]);
});

test("public machine-readable routes are available", async ({ request }) => {
  for (const route of documentRoutes) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }
});

test("the shared skip link is the first keyboard target", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");

  const skipLink = page.locator('a.skip-link[href="#main-content"]');
  await expect(skipLink).toBeFocused();
  await expect(skipLink).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/#main-content$/);
  await expect(page.locator("main#main-content")).toBeFocused();
});

test("the locale switcher writes a cookie that the server renders in", async ({
  page,
}) => {
  await page.goto("/products");
  const shell = page.locator(".site-shell");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(shell).toHaveAttribute("lang", "vi");
  await expect(heading).toHaveText(/Tìm đúng lá bài/);

  await page.getByRole("button", { name: "English" }).click();
  await expect(shell).toHaveAttribute("lang", "en");
  await expect(heading).toHaveText(/Find the right card/);

  const cookies = await page.context().cookies();
  expect(cookies.find((cookie) => cookie.name === "masterball_locale")?.value).toBe("en");

  await page.getByRole("button", { name: "Tiếng Việt" }).click();
  await expect(shell).toHaveAttribute("lang", "vi");
  await expect(heading).toHaveText(/Tìm đúng lá bài/);
});

test("unauthenticated admin requests redirect to login", async ({ page }) => {
  const response = await page.goto("/admin/orders");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.locator("form")).toBeVisible();
});

test("VNPAY Return and IPN endpoints fail closed", async ({ request }) => {
  const secret = process.env.VNPAY_HASH_SECRET ?? "test-only-vnpay-secret";
  const returnParams = {
    vnp_Amount: "10000",
    vnp_ResponseCode: "00",
    vnp_TmnCode: process.env.VNPAY_TMN_CODE ?? "TEST",
    vnp_TransactionStatus: "00",
    vnp_TxnRef: "MISSING-ORDER",
  };

  const invalidReturn = await request.get(
    `/api/payments/vnpay/return?${new URLSearchParams({
      ...returnParams,
      vnp_SecureHash: "0".repeat(128),
    })}`,
  );
  expect(invalidReturn.status()).toBe(400);
  expect(invalidReturn.headers()["cache-control"]).toBe("no-store");

  const validReturn = await request.get(
    `/api/payments/vnpay/return?${new URLSearchParams({
      ...returnParams,
      vnp_SecureHash: signVnpay(returnParams, secret),
    })}`,
  );
  expect(validReturn.status()).toBe(200);
  expect(await validReturn.text()).toContain("IPN");

  const invalidIpn = await request.get(
    `/api/payments/vnpay/ipn?${new URLSearchParams({
      ...returnParams,
      vnp_SecureHash: "0".repeat(128),
    })}`,
  );
  expect(invalidIpn.status()).toBe(200);
  expect(await invalidIpn.json()).toEqual({
    Message: "Invalid signature",
    RspCode: "97",
  });

  const validButUnpersistableIpn = await request.get(
    `/api/payments/vnpay/ipn?${new URLSearchParams({
      ...returnParams,
      vnp_SecureHash: signVnpay(returnParams, secret),
    })}`,
  );
  expect(validButUnpersistableIpn.status()).toBe(200);
  const ipnResult = (await validButUnpersistableIpn.json()) as {
    Message: string;
    RspCode: string;
  };
  expect(ipnResult.RspCode).not.toBe("00");
  expect(ipnResult.Message).not.toBe("Confirm Success");
});
