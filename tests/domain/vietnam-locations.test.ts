import { afterEach, describe, expect, it, vi } from "vitest";

import { listVietnamProvinces } from "@/modules/checkout/vietnam-locations";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Vietnam province list", () => {
  it("aborts a hung upstream at the request timeout and degrades to an empty list", async () => {
    const controller = new AbortController();
    const timeout = vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            const signal = init?.signal;
            if (signal) signal.addEventListener("abort", () => reject(signal.reason));
          }),
      ),
    );

    const pending = listVietnamProvinces();
    controller.abort(new DOMException("The operation timed out.", "TimeoutError"));

    await expect(pending).resolves.toEqual([]);
    expect(timeout).toHaveBeenCalledWith(10_000);
  });

  it("returns the parsed provinces and keeps the day-long cache revalidation", async () => {
    const fetchStub = vi.fn<
      (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(
      async () =>
        new Response(JSON.stringify([{ code: 1, name: "Hà Nội" }]), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    );
    vi.stubGlobal("fetch", fetchStub);

    await expect(listVietnamProvinces()).resolves.toEqual([{ code: 1, name: "Hà Nội" }]);
    expect(fetchStub.mock.calls[0]?.[1]).toMatchObject({ next: { revalidate: 86_400 } });
  });

  it("falls back to an empty list when the upstream payload is invalid", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify([{ code: -1 }]), { status: 200 })),
    );

    await expect(listVietnamProvinces()).resolves.toEqual([]);
  });

  it("falls back to an empty list when the upstream responds with an error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 503 })));

    await expect(listVietnamProvinces()).resolves.toEqual([]);
  });
});
