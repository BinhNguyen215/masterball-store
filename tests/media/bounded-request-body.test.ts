import { describe, expect, it, vi } from "vitest";

import {
  MediaRequestTooLargeError,
  readBoundedRequestBody,
} from "@/modules/media";

function streamedRequest(chunks: Uint8Array[], onCancel?: () => void) {
  let nextChunk = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (nextChunk === chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(chunks[nextChunk]);
      nextChunk += 1;
    },
    cancel() {
      onCancel?.();
    },
  });
  return new Request("https://example.test/api/admin/media", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit & { duplex: "half" });
}

describe("bounded multipart body reader", () => {
  it("accepts an exact-size streamed body without Content-Length", async () => {
    const request = streamedRequest([
      Uint8Array.from([1, 2]),
      Uint8Array.from([3, 4]),
    ]);
    await expect(readBoundedRequestBody(request, 4)).resolves.toEqual(
      Uint8Array.from([1, 2, 3, 4]),
    );
  });

  it("cancels and rejects a chunked body as soon as the actual limit is exceeded", async () => {
    const cancelled = vi.fn();
    const request = streamedRequest(
      [new Uint8Array(4), new Uint8Array(4), new Uint8Array(4)],
      cancelled,
    );

    await expect(readBoundedRequestBody(request, 10)).rejects.toBeInstanceOf(
      MediaRequestTooLargeError,
    );
    expect(request.headers.has("content-length")).toBe(false);
    expect(cancelled).toHaveBeenCalledTimes(1);
  });
});
