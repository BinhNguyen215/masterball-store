import { randomUUID } from "node:crypto";

export const requestIdHeader = "x-request-id";

export function getRequestId(headers: Headers): string {
  const supplied = headers.get(requestIdHeader)?.trim();

  if (supplied && /^[a-zA-Z0-9._:-]{8,128}$/.test(supplied)) {
    return supplied;
  }

  return randomUUID();
}
