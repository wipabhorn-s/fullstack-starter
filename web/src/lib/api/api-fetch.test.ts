import { clientIpFrom } from "@/lib/api/api-fetch";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

describe("clientIpFrom (IP forwarded to the API for rate limiting)", () => {
  it("takes the first address in X-Forwarded-For (the user, not the proxies)", () => {
    expect(
      clientIpFrom(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.2" })),
    ).toBe("203.0.113.7");
  });

  it("falls back to X-Real-IP", () => {
    expect(clientIpFrom(new Headers({ "x-real-ip": "198.51.100.4" }))).toBe(
      "198.51.100.4",
    );
  });

  it("sends nothing when the request has no IP headers", () => {
    expect(clientIpFrom(new Headers())).toBeUndefined();
  });
});

describe("apiFetch forwards the visitor's IP to the API", () => {
  const sentHeaders = async (secret: string | undefined) => {
    vi.resetModules();
    vi.doMock("@/lib/env", () => ({
      env: { API_URL: "http://api.test", INTERNAL_API_SECRET: secret },
    }));
    const fetchMock = vi.fn(() => Promise.resolve(new Response("{}")));
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch } = await import("@/lib/api/api-fetch");

    await apiFetch("/items", { clientIp: "203.0.113.7" });

    vi.unstubAllGlobals();
    const init = (fetchMock.mock.calls[0] as unknown[])[1] as RequestInit;
    return new Headers(init.headers);
  };

  it("production: sends X-Client-IP with the shared secret", async () => {
    const headers = await sentHeaders("s".repeat(40));
    expect(headers.get("x-client-ip")).toBe("203.0.113.7");
    expect(headers.get("x-internal-secret")).toBe("s".repeat(40));
    expect(headers.get("x-forwarded-for")).toBeNull();
  });

  it("dev (no secret): sends X-Forwarded-For only", async () => {
    const headers = await sentHeaders(undefined);
    expect(headers.get("x-forwarded-for")).toBe("203.0.113.7");
    expect(headers.get("x-internal-secret")).toBeNull();
  });
});

describe("apiFetch waits for a sleeping API", () => {
  const badGateway = () => new Response("Bad Gateway", { status: 502 });
  const ok = () => new Response(JSON.stringify({ items: [] }));

  /** apiFetch ที่ fetch ตอบตามลำดับที่กำหนด (เวลาเดินด้วย fake timer) */
  const setup = async (responses: (() => Response | Promise<never>)[]) => {
    vi.resetModules();
    vi.useFakeTimers();
    vi.doMock("@/lib/env", () => ({
      env: { API_URL: "http://api.test", INTERNAL_API_SECRET: undefined },
    }));
    const fetchMock = vi.fn(() =>
      Promise.resolve().then(() => responses.shift()!()),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { apiFetch, RETRY_DELAYS_MS } = await import("@/lib/api/api-fetch");
    return { apiFetch, fetchMock, attempts: RETRY_DELAYS_MS.length + 1 };
  };

  /** เดินเวลาจนคำขอจบ แล้วคืนผล (หรือ error) */
  const settle = async <T>(promise: Promise<T>) => {
    const result = promise.then(
      (value) => ({ value }),
      (error: unknown) => ({ error }),
    );
    await vi.runAllTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    return result;
  };

  it("retries a GET until the API is up", async () => {
    const { apiFetch, fetchMock } = await setup([badGateway, badGateway, ok]);

    const result = await settle(apiFetch("/items", { clientIp: "1.1.1.1" }));

    expect(result).toEqual({ value: { items: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("sends each retry as a fresh request (React would replay a memoized GET)", async () => {
    const { apiFetch, fetchMock } = await setup([badGateway, ok]);

    await settle(apiFetch("/items", { clientIp: "1.1.1.1" }));

    const signals = (fetchMock.mock.calls as unknown[][]).map(
      (call) => (call[1] as RequestInit).signal,
    );
    expect(signals[0]).toBeUndefined();
    expect(signals[1]).toBeInstanceOf(AbortSignal);
  });

  it("retries when the connection is refused", async () => {
    const { apiFetch, fetchMock } = await setup([
      () => Promise.reject(new TypeError("fetch failed")),
      ok,
    ]);

    const result = await settle(apiFetch("/items", { clientIp: "1.1.1.1" }));

    expect(result).toEqual({ value: { items: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up with the real error after the last retry", async () => {
    const { apiFetch, fetchMock, attempts } = await setup(
      Array.from({ length: 20 }, () => badGateway),
    );

    const result = await settle(apiFetch("/items", { clientIp: "1.1.1.1" }));

    expect(result).toMatchObject({ error: { statusCode: 502 } });
    // ครั้งแรก + ลองใหม่ตามจำนวนรอบที่กำหนด แล้วหยุด (ไม่วนไม่จบ)
    expect(fetchMock).toHaveBeenCalledTimes(attempts);
  });

  it("never resends a POST unless the caller says it is safe (could duplicate data)", async () => {
    const { apiFetch, fetchMock } = await setup([badGateway, ok]);

    const result = await settle(
      apiFetch("/orders", {
        method: "POST",
        body: { quantity: 1 },
        clientIp: "1.1.1.1",
      }),
    );

    expect(result).toMatchObject({ error: { statusCode: 502 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resends a POST marked retry (login)", async () => {
    const { apiFetch, fetchMock } = await setup([badGateway, ok]);

    const result = await settle(
      apiFetch("/auth/google", {
        method: "POST",
        body: { idToken: "t" },
        retry: true,
        clientIp: "1.1.1.1",
      }),
    );

    expect(result).toEqual({ value: { items: [] } });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry ordinary errors like 404", async () => {
    const { apiFetch, fetchMock } = await setup([
      () =>
        new Response(JSON.stringify({ message: "Not found" }), {
          status: 404,
        }),
    ]);

    const result = await settle(
      apiFetch("/items/9", { clientIp: "1.1.1.1" }),
    );

    expect(result).toMatchObject({ error: { statusCode: 404 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
