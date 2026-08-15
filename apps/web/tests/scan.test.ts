import { afterEach, describe, expect, it, vi } from "vitest";
import { submitScan } from "@/lib/scan";
import type { ScanResult } from "@/lib/scan";

const RESULT: ScanResult = {
  schemaVersion: "1.0.0",
  scanId: "01J123456789ABCDEFGHJKLMNP",
  url: "https://example.com",
  violations: [],
  vitals: { lcp: null, inp: null, cls: null },
  timestamp: "2026-08-15T12:30:00.000Z",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

function fetchLike(opts: { ok: boolean; status: number; body?: unknown; jsonThrows?: boolean }) {
  return {
    ok: opts.ok,
    status: opts.status,
    json: async () => {
      if (opts.jsonThrows) throw new Error("invalid json");
      return opts.body;
    },
  } as unknown as Response;
}

describe("submitScan", () => {
  it("returns ok with data for a valid 200 envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchLike({ ok: true, status: 200, body: RESULT })));
    await expect(submitScan("https://example.com")).resolves.toEqual({ ok: true, data: RESULT });
  });

  it("returns unreachable when the fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const result = await submitScan("https://example.com");
    expect({ ok: result.ok, ...(result.ok ? {} : { code: result.code, status: result.status }) }).toEqual(
      { ok: false, code: "unreachable", status: 0 },
    );
  });

  it("returns invalid_response for a non-JSON response body", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchLike({ ok: true, status: 200, jsonThrows: true })));
    const result = await submitScan("https://example.com");
    expect({ ok: result.ok, ...(result.ok ? {} : { code: result.code, status: result.status }) }).toEqual(
      { ok: false, code: "invalid_response", status: 200 },
    );
  });

  it("returns invalid_response when a 200 body has an invalid shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchLike({ ok: true, status: 200, body: { url: "x" } })));
    const result = await submitScan("https://example.com");
    expect({ ok: result.ok, ...(result.ok ? {} : { code: result.code, status: result.status }) }).toEqual(
      { ok: false, code: "invalid_response", status: 200 },
    );
  });

  it("propagates an error envelope from the route", async () => {
    const body = { code: "unreachable", message: "host down", stage: "harvest" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchLike({ ok: false, status: 502, body })));
    const result = await submitScan("https://example.com");
    expect({
      ok: result.ok,
      ...(result.ok ? {} : { code: result.code, message: result.message, status: result.status }),
    }).toEqual({ ok: false, code: "unreachable", message: "host down", status: 502 });
  });
});