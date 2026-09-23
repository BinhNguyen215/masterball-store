import {
  canonicalizeVnpayParameters,
  createVnpaySignature,
  verifyVnpaySignature,
  type VnpayParameters,
} from "./vnpay-signature";

export type VnpayConfig = {
  tmnCode: string;
  hashSecret: string;
  paymentUrl: string;
  returnUrl: string;
  apiUrl: string;
};

function requiredEnvironment(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for VNPAY.`);
  return value;
}

const LOOPBACK_HOSTS: Record<string, true> = {
  localhost: true,
  "127.0.0.1": true,
  "[::1]": true,
};

function requiredPaymentUrl(name: string): string {
  const value = requiredEnvironment(name);
  if (process.env.NODE_ENV !== "production") return value;
  if (value.startsWith("https://")) return value;
  // Local production-mode runs (a built server on loopback) still need a usable
  // return URL; only non-loopback hosts must be HTTPS.
  try {
    const parsed = new URL(value);
    if (parsed.protocol === "http:" && LOOPBACK_HOSTS[parsed.hostname] === true) {
      return value;
    }
  } catch {
    // fall through to the HTTPS requirement below
  }
  throw new Error(`${name} must use HTTPS in production.`);
}

export function getVnpayConfig(): VnpayConfig {
  return {
    tmnCode: requiredEnvironment("VNPAY_TMN_CODE"),
    hashSecret: requiredEnvironment("VNPAY_HASH_SECRET"),
    paymentUrl: requiredPaymentUrl("VNPAY_PAYMENT_URL"),
    returnUrl: requiredPaymentUrl("VNPAY_RETURN_URL"),
    apiUrl: requiredPaymentUrl("VNPAY_API_URL"),
  };
}

export function formatVnpayDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => {
      if (part.type !== "literal") result[part.type] = part.value;
      return result;
    }, {});
  return `${parts.year}${parts.month}${parts.day}${parts.hour}${parts.minute}${parts.second}`;
}

export function buildVnpayPaymentUrl(input: {
  amountVnd: number;
  transactionReference: string;
  orderInfo: string;
  ipAddress: string;
  createdAt?: Date;
  expiresInMinutes?: number;
  locale?: "vn" | "en";
  config?: VnpayConfig;
}): string {
  if (!Number.isSafeInteger(input.amountVnd) || input.amountVnd < 0) {
    throw new Error("VNPAY amount must be a non-negative integer VND value.");
  }
  const config = input.config ?? getVnpayConfig();
  const createdAt = input.createdAt ?? new Date();
  const expiresAt = new Date(
    createdAt.getTime() + Math.max(5, input.expiresInMinutes ?? 15) * 60_000,
  );
  const params: VnpayParameters = {
    vnp_Version: "2.1.0",
    vnp_Command: "pay",
    vnp_TmnCode: config.tmnCode,
    vnp_Amount: input.amountVnd * 100,
    vnp_CurrCode: "VND",
    vnp_TxnRef: input.transactionReference,
    vnp_OrderInfo: input.orderInfo,
    vnp_OrderType: "other",
    vnp_Locale: input.locale ?? "vn",
    vnp_ReturnUrl: config.returnUrl,
    vnp_IpAddr: input.ipAddress,
    vnp_CreateDate: formatVnpayDate(createdAt),
    vnp_ExpireDate: formatVnpayDate(expiresAt),
  };
  const signature = createVnpaySignature(params, config.hashSecret);
  return `${config.paymentUrl}?${canonicalizeVnpayParameters(params)}&vnp_SecureHash=${signature}`;
}

export function inspectVnpayReturn(
  params: VnpayParameters,
  config: Pick<VnpayConfig, "hashSecret" | "tmnCode"> = getVnpayConfig(),
) {
  const verified =
    params.vnp_TmnCode === config.tmnCode &&
    verifyVnpaySignature(params, config.hashSecret);
  const successful =
    verified &&
    params.vnp_ResponseCode === "00" &&
    params.vnp_TransactionStatus === "00";
  return {
    verified,
    successful,
    transactionReference:
      typeof params.vnp_TxnRef === "string" ? params.vnp_TxnRef : null,
    providerTransactionId:
      typeof params.vnp_TransactionNo === "string" ? params.vnp_TransactionNo : null,
    responseCode:
      typeof params.vnp_ResponseCode === "string" ? params.vnp_ResponseCode : null,
    transactionStatus:
      typeof params.vnp_TransactionStatus === "string"
        ? params.vnp_TransactionStatus
        : null,
  };
}
