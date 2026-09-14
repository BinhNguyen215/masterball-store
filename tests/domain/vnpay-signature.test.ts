import { describe, expect, it } from "vitest";

import {
  buildVnpayPaymentUrl,
  canonicalizeVnpayParameters,
  createVnpaySignature,
  createVnpayEventId,
  inspectVnpayReturn,
  processVnpayIpn,
  verifyVnpaySignature,
} from "@/modules/payments";

describe("VNPAY 2.1.0 signature primitives", () => {
  const params = {
    vnp_TxnRef: "MB-ABC",
    vnp_TmnCode: "DEMO",
    vnp_Amount: "10000000",
    vnp_Command: "pay",
    vnp_Version: "2.1.0",
  };

  it("sorts encoded parameters and matches a fixed HMAC-SHA512 vector", () => {
    expect(canonicalizeVnpayParameters(params)).toBe(
      "vnp_Amount=10000000&vnp_Command=pay&vnp_TmnCode=DEMO&vnp_TxnRef=MB-ABC&vnp_Version=2.1.0",
    );
    expect(createVnpaySignature(params, "test-secret")).toBe(
      "708c19bc53ad46df083c8c16fad38b94f195ff11b080ab7cc3828a955f832b95eaa04c1f78917920d4d937681cfc24b7e31ca2f8ec59f999affdbe5e91e568ba",
    );
  });

  it("uses constant-length validation and rejects tampering", () => {
    const signature = createVnpaySignature(params, "test-secret");
    expect(verifyVnpaySignature({ ...params, vnp_SecureHash: signature }, "test-secret")).toBe(true);
    expect(verifyVnpaySignature({ ...params, vnp_Amount: "20000000", vnp_SecureHash: signature }, "test-secret")).toBe(false);
    expect(verifyVnpaySignature({ ...params, vnp_SecureHash: "bad" }, "test-secret")).toBe(false);
  });

  it("builds VND*100 requests without vnp_SecureHashType", () => {
    const url = buildVnpayPaymentUrl({
      amountVnd: 100_000,
      transactionReference: "MB-ABC",
      orderInfo: "Order MB-ABC",
      ipAddress: "127.0.0.1",
      createdAt: new Date("2026-09-14T12:00:00Z"),
      config: {
        tmnCode: "DEMO",
        hashSecret: "test-secret",
        paymentUrl: "https://sandbox.vnpayment.vn/paymentv2/vpcpay.html",
        returnUrl: "https://example.com/payment-return",
        apiUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
      },
    });
    const search = new URL(url).searchParams;
    expect(search.get("vnp_Amount")).toBe("10000000");
    expect(search.get("vnp_Version")).toBe("2.1.0");
    expect(search.has("vnp_SecureHashType")).toBe(false);
  });

  it("keeps Return URL inspection read-only", () => {
    const returnParams = {
      ...params,
      vnp_ResponseCode: "00",
      vnp_TransactionStatus: "00",
    };
    const signed = {
      ...returnParams,
      vnp_SecureHash: createVnpaySignature(returnParams, "test-secret"),
    };
    expect(inspectVnpayReturn(signed, { hashSecret: "test-secret", tmnCode: "DEMO" })).toMatchObject({
      verified: true,
      successful: true,
      transactionReference: "MB-ABC",
    });
    expect(
      inspectVnpayReturn(signed, {
        hashSecret: "test-secret",
        tmnCode: "ANOTHER_MERCHANT",
      }),
    ).toMatchObject({ verified: false, successful: false });
  });

  it("rejects an invalid IPN checksum before any database access", async () => {
    const previous = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;
    await expect(
      processVnpayIpn(
        { ...params, vnp_SecureHash: "0".repeat(128) },
        { hashSecret: "test-secret", tmnCode: "DEMO" },
      ),
    ).resolves.toEqual({ RspCode: "97", Message: "Invalid Checksum" });
    if (previous !== undefined) process.env.DATABASE_URL = previous;
  });

  it("rejects a signed IPN for another merchant before database access", async () => {
    const signedForAnotherMerchant = {
      ...params,
      vnp_TmnCode: "OTHER",
    };
    const signed = {
      ...signedForAnotherMerchant,
      vnp_SecureHash: createVnpaySignature(
        signedForAnotherMerchant,
        "test-secret",
      ),
    };

    await expect(
      processVnpayIpn(signed, {
        hashSecret: "test-secret",
        tmnCode: "DEMO",
      }),
    ).resolves.toEqual({ RspCode: "97", Message: "Invalid merchant" });
  });

  it("deduplicates exact events but allows a corrected amount to be processed", () => {
    const event = {
      vnp_Amount: "10000000",
      vnp_ResponseCode: "00",
      vnp_TransactionNo: "123456",
      vnp_TransactionStatus: "00",
      vnp_TxnRef: "MB-ABC",
    };

    expect(createVnpayEventId(event)).toBe(createVnpayEventId({ ...event }));
    expect(createVnpayEventId(event)).not.toBe(
      createVnpayEventId({ ...event, vnp_Amount: "20000000" }),
    );
  });
});
