// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/scan/route";

const ENVELOPE = {
  schemaVersion: "1.0.0",
  scanId: "01J123456789ABCDEFGHJKLMNP",
  url: "https://example.com",
  violations: [],
  vitals: { lcp: null, inp: null, cls: null },
  timestamp: "2026-08-15T12:30:00.000Z",
};

const SCANNER_URL = "http://127.0.0.1:8000";

afterEach(() => {
  vi.unstubAllGlobals();
});

function scannerResponse(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function callPost(requestBody: string) {
  return POST(
    new Request("http://localhost/api/scan", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: requestBody,
    }),
  );
}

describe("POST /api/scan", () => {
  it("passes a 200 ScanResult envelope through unchanged", async () => {
    const fetchMock = vi.fn().mockResolvedValue(scannerResponse(ENVELOPE, 200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ url: "https://example.com" }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual(ENVELOPE);
    expect(fetchMock).toHaveBeenCalledWith(
      `${SCANNER_URL}/scan`,
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://example.com" }),
      }),
    );
  });

  it("returns 400 for a non-JSON body", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost("not json");

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_url");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a blank url", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ url: "   " }));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe("invalid_url");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 502 unreachable when the scanner fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect refused")));

    const res = await callPost(JSON.stringify({ url: "https://example.com" }));

    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.code).toBe("unreachable");
  });

  it("passes a scanner 502 envelope (status + body) through", async () => {
    const envelope = { code: "unreachable", message: "host down", stage: "harvest" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(scannerResponse(envelope, 502)));

    const res = await callPost(JSON.stringify({ url: "https://example.com" }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual(envelope);
  });

  it("passes a scanner 500 envelope (status + body) through", async () => {
    const envelope = { code: "scan_error", message: "boom", stage: "harvest" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(scannerResponse(envelope, 500)));

    const res = await callPost(JSON.stringify({ url: "https://example.com" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual(envelope);
  });

  it("passes a scanner 503 busy envelope (status + body) through", async () => {
    const envelope = { code: "busy", message: "No scan slots available.", stage: "harvest" };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(scannerResponse(envelope, 503)));

    const res = await callPost(JSON.stringify({ url: "https://example.com" }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toEqual(envelope);
  });
});