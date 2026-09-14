import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { formatVnpayDate, type VnpayConfig } from "./vnpay-adapter";

const requestSignatureFields = [
  "vnp_RequestId",
  "vnp_Version",
  "vnp_Command",
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_TransactionDate",
  "vnp_CreateDate",
  "vnp_IpAddr",
  "vnp_OrderInfo",
] as const;

const responseSignatureFields = [
  "vnp_ResponseId",
  "vnp_Command",
  "vnp_ResponseCode",
  "vnp_Message",
  "vnp_TmnCode",
  "vnp_TxnRef",
  "vnp_Amount",
  "vnp_BankCode",
  "vnp_PayDate",
  "vnp_TransactionNo",
  "vnp_TransactionType",
  "vnp_TransactionStatus",
  "vnp_OrderInfo",
  "vnp_PromotionCode",
  "vnp_PromotionAmount",
] as const;

export type VnpayQueryRequest = {
  vnp_RequestId: string;
  vnp_Version: "2.1.0";
  vnp_Command: "querydr";
  vnp_TmnCode: string;
  vnp_TxnRef: string;
  vnp_TransactionDate: string;
  vnp_CreateDate: string;
  vnp_IpAddr: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo?: string;
  vnp_SecureHash: string;
};

export type VnpayQueryResponse = Record<string, string> & {
  vnp_ResponseId: string;
  vnp_Command: string;
  vnp_ResponseCode: string;
  vnp_Message: string;
  vnp_TmnCode: string;
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_TransactionStatus: string;
  vnp_SecureHash: string;
};

export class VnpayQueryError extends Error {
  constructor(
    message: string,
    readonly code:
      | "INVALID_RESPONSE"
      | "INVALID_SIGNATURE"
      | "MISMATCHED_RESPONSE"
      | "PROVIDER_REJECTED"
      | "NETWORK_ERROR",
  ) {
    super(message);
    this.name = "VnpayQueryError";
  }
}

const responseRecordSchema = z.record(
  z.string(),
  z.union([z.string(), z.number(), z.null()]),
);

function pipeValues(
  values: Record<string, string | number | undefined>,
  fields: readonly string[],
): string {
  return fields.map((field) => String(values[field] ?? "")).join("|");
}

function hmacSha512(value: string, secret: string): string {
  return createHmac("sha512", secret).update(value, "utf8").digest("hex");
}

function signaturesMatch(received: string, expected: string): boolean {
  if (!/^[a-f\d]{128}$/i.test(received)) return false;
  const receivedBuffer = Buffer.from(received.toLowerCase(), "hex");
  const expectedBuffer = Buffer.from(expected.toLowerCase(), "hex");
  return (
    receivedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(receivedBuffer, expectedBuffer)
  );
}

export function createVnpayQueryRequestChecksum(
  values: Omit<VnpayQueryRequest, "vnp_SecureHash">,
  secret: string,
): string {
  return hmacSha512(pipeValues(values, requestSignatureFields), secret);
}

export function createVnpayQueryResponseChecksum(
  values: Record<string, string | number | undefined>,
  secret: string,
): string {
  return hmacSha512(pipeValues(values, responseSignatureFields), secret);
}

export function buildVnpayQueryRequest(input: {
  requestId: string;
  transactionReference: string;
  transactionDate: Date;
  ipAddress: string;
  orderInfo: string;
  providerTransactionId?: string | null;
  createdAt?: Date;
  config: Pick<VnpayConfig, "hashSecret" | "tmnCode">;
}): VnpayQueryRequest {
  const unsigned: Omit<VnpayQueryRequest, "vnp_SecureHash"> = {
    vnp_RequestId: input.requestId,
    vnp_Version: "2.1.0",
    vnp_Command: "querydr",
    vnp_TmnCode: input.config.tmnCode,
    vnp_TxnRef: input.transactionReference,
    vnp_TransactionDate: formatVnpayDate(input.transactionDate),
    vnp_CreateDate: formatVnpayDate(input.createdAt ?? new Date()),
    vnp_IpAddr: input.ipAddress,
    vnp_OrderInfo: input.orderInfo,
    ...(input.providerTransactionId
      ? { vnp_TransactionNo: input.providerTransactionId }
      : {}),
  };
  return {
    ...unsigned,
    vnp_SecureHash: createVnpayQueryRequestChecksum(unsigned, input.config.hashSecret),
  };
}

export function verifyVnpayQueryResponse(input: {
  body: unknown;
  request: VnpayQueryRequest;
  config: Pick<VnpayConfig, "hashSecret" | "tmnCode">;
}): VnpayQueryResponse {
  const parsed = responseRecordSchema.safeParse(input.body);
  if (!parsed.success) {
    throw new VnpayQueryError("VNPAY returned an invalid QueryDr payload.", "INVALID_RESPONSE");
  }
  const values = Object.fromEntries(
    Object.entries(parsed.data).map(([key, value]) => [key, value === null ? "" : String(value)]),
  );
  const signature = values.vnp_SecureHash ?? "";
  const expected = createVnpayQueryResponseChecksum(values, input.config.hashSecret);
  if (!signaturesMatch(signature, expected)) {
    throw new VnpayQueryError("VNPAY QueryDr response checksum is invalid.", "INVALID_SIGNATURE");
  }
  if (
    values.vnp_Command !== "querydr" ||
    values.vnp_TmnCode !== input.config.tmnCode ||
    values.vnp_TxnRef !== input.request.vnp_TxnRef
  ) {
    throw new VnpayQueryError("VNPAY QueryDr response does not match the request.", "MISMATCHED_RESPONSE");
  }
  if (values.vnp_ResponseCode !== "00") {
    throw new VnpayQueryError(
      `VNPAY rejected QueryDr with response code ${values.vnp_ResponseCode || "unknown"}.`,
      "PROVIDER_REJECTED",
    );
  }
  if (!values.vnp_Amount || !values.vnp_TransactionStatus) {
    throw new VnpayQueryError("VNPAY QueryDr response is incomplete.", "INVALID_RESPONSE");
  }
  return values as VnpayQueryResponse;
}

export async function queryVnpayTransaction(input: {
  requestId: string;
  transactionReference: string;
  transactionDate: Date;
  ipAddress: string;
  orderInfo: string;
  providerTransactionId?: string | null;
  createdAt?: Date;
  config: Pick<VnpayConfig, "apiUrl" | "hashSecret" | "tmnCode">;
  fetchImplementation?: typeof fetch;
}): Promise<VnpayQueryResponse> {
  const request = buildVnpayQueryRequest(input);
  const requestFetch = input.fetchImplementation ?? fetch;
  let response: Response;
  try {
    response = await requestFetch(input.config.apiUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    throw new VnpayQueryError(
      `VNPAY QueryDr request failed: ${error instanceof Error ? error.message : "network error"}`,
      "NETWORK_ERROR",
    );
  }
  if (!response.ok) {
    throw new VnpayQueryError(
      `VNPAY QueryDr returned HTTP ${response.status}.`,
      "NETWORK_ERROR",
    );
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new VnpayQueryError("VNPAY QueryDr returned invalid JSON.", "INVALID_RESPONSE");
  }
  return verifyVnpayQueryResponse({ body, request, config: input.config });
}
