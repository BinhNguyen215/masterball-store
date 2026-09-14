import { describe, expect, it } from "vitest";

import {
  buildVnpayQueryRequest,
  createVnpayQueryResponseChecksum,
  queryVnpayTransaction,
  verifyVnpayQueryResponse,
  VnpayQueryError,
} from "@/modules/payments";

const config = {
  apiUrl: "https://sandbox.vnpayment.vn/merchant_webapi/api/transaction",
  hashSecret: "test-secret",
  tmnCode: "DEMO",
};

function request() {
  return buildVnpayQueryRequest({
    requestId: "REQ123",
    transactionReference: "MB-ABC",
    transactionDate: new Date("2026-09-14T12:00:00Z"),
    createdAt: new Date("2026-09-14T12:05:06Z"),
    ipAddress: "127.0.0.1",
    orderInfo: "Query transaction MB-ABC",
    config,
  });
}

function signedResponse(overrides: Record<string, string> = {}) {
  const values = {
    vnp_ResponseId: "VNPAYRESP456",
    vnp_Command: "querydr",
    vnp_ResponseCode: "00",
    vnp_Message: "Success",
    vnp_TmnCode: "DEMO",
    vnp_TxnRef: "MB-ABC",
    vnp_Amount: "10000000",
    vnp_BankCode: "NCB",
    vnp_PayDate: "20260914190100",
    vnp_TransactionNo: "123456",
    vnp_TransactionType: "01",
    vnp_TransactionStatus: "00",
    vnp_OrderInfo: "Order MB-ABC",
    vnp_PromotionCode: "",
    vnp_PromotionAmount: "0",
    ...overrides,
  };
  return {
    ...values,
    vnp_SecureHash: createVnpayQueryResponseChecksum(values, config.hashSecret),
  };
}

describe("VNPAY QueryDr 2.1.0", () => {
  it("builds the documented pipe-delimited request checksum", () => {
    expect(request()).toEqual({
      vnp_RequestId: "REQ123",
      vnp_Version: "2.1.0",
      vnp_Command: "querydr",
      vnp_TmnCode: "DEMO",
      vnp_TxnRef: "MB-ABC",
      vnp_TransactionDate: "20260914190000",
      vnp_CreateDate: "20260914190506",
      vnp_IpAddr: "127.0.0.1",
      vnp_OrderInfo: "Query transaction MB-ABC",
      vnp_SecureHash:
        "153c8aa6941d3358a1ac01962216a7cb4ac91b434e909c4bb76f73d75fdbcd2bd598b956daddbea45087ca6dd0a88a1c60c5cf0a4d0c2ab4216de01d7dbd4f62",
    });
  });

  it("accepts a matching signed response and rejects tampering", () => {
    const response = signedResponse();
    expect(response.vnp_SecureHash).toBe(
      "3a1c3ad005db2514385a47e07b2fa3528739e3b1d0204964bc8756e5facc3a937e2b9c016a46c34c91815cbded51a7bea31754edb600ea4097f6dae8b2d2c479",
    );
    expect(
      verifyVnpayQueryResponse({ body: response, request: request(), config }),
    ).toMatchObject({
      vnp_TxnRef: "MB-ABC",
      vnp_Amount: "10000000",
      vnp_TransactionStatus: "00",
    });
    expect(() =>
      verifyVnpayQueryResponse({
        body: { ...response, vnp_Amount: "20000000" },
        request: request(),
        config,
      }),
    ).toThrowError(VnpayQueryError);
  });

  it("rejects a correctly signed response for a different merchant", () => {
    const response = signedResponse({ vnp_TmnCode: "OTHER" });
    expect(() =>
      verifyVnpayQueryResponse({ body: response, request: request(), config }),
    ).toThrowError(/does not match/);
  });

  it("posts JSON to QueryDr and verifies the provider response", async () => {
    let receivedBody: unknown;
    const fetchImplementation: typeof fetch = async (_url, init) => {
      receivedBody = JSON.parse(String(init?.body));
      return new Response(JSON.stringify(signedResponse()), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    await expect(
      queryVnpayTransaction({
        requestId: "REQ123",
        transactionReference: "MB-ABC",
        transactionDate: new Date("2026-09-14T12:00:00Z"),
        createdAt: new Date("2026-09-14T12:05:06Z"),
        ipAddress: "127.0.0.1",
        orderInfo: "Query transaction MB-ABC",
        config,
        fetchImplementation,
      }),
    ).resolves.toMatchObject({ vnp_TransactionNo: "123456" });
    expect(receivedBody).toEqual(request());
  });
});
