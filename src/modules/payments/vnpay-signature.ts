import { createHmac, timingSafeEqual } from "node:crypto";

export type VnpayParameters = Record<string, string | number | undefined>;

function encode(value: string): string {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) =>
    `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export function canonicalizeVnpayParameters(params: VnpayParameters): string {
  return Object.entries(params)
    .filter(
      ([key, value]) =>
        key !== "vnp_SecureHash" &&
        key !== "vnp_SecureHashType" &&
        value !== undefined &&
        String(value) !== "",
    )
    .sort(([left], [right]) => left.localeCompare(right, "en"))
    .map(([key, value]) => `${encode(key)}=${encode(String(value))}`)
    .join("&");
}

export function createVnpaySignature(
  params: VnpayParameters,
  hashSecret: string,
): string {
  return createHmac("sha512", hashSecret)
    .update(canonicalizeVnpayParameters(params), "utf8")
    .digest("hex");
}

export function verifyVnpaySignature(
  params: VnpayParameters,
  hashSecret: string,
): boolean {
  const signature = params.vnp_SecureHash;
  if (typeof signature !== "string" || !/^[a-fA-F0-9]{128}$/.test(signature)) {
    return false;
  }
  const expected = Buffer.from(createVnpaySignature(params, hashSecret), "hex");
  const received = Buffer.from(signature, "hex");
  return received.length === expected.length && timingSafeEqual(received, expected);
}
