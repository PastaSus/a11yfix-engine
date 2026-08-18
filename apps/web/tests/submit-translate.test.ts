import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuditReport, submitTranslate } from "@/lib/submit-translate";
import type { ScanResult } from "@/lib/scan";
import { makeImpact, makePatch, makeReport } from "@/tests/fixtures";
import type { AuditReport } from "@/lib/translate/client";

const SCAN: ScanResult = {
  schemaVersion: "1.0.0",
  scanId: "01J123456789ABCDEFGHJKLMNP",
  url: "https://example.com",
  violations: [
    {
      id: "color-contrast",
      impact: "critical",
      description: "Elements must meet minimum color contrast ratio thresholds",
      helpUrl: null,
      nodes: [{ nodeId: "a[href]", coordinates: null }],
    },
  ],
  vitals: { lcp: 1200, inp: null, cls: 0.1 },
  timestamp: "2026-08-15T12:30:00.000Z",
};

const REPORT: AuditReport = makeReport(
  SCAN.violations,
  [makeImpact("color-contrast")],
  [makePatch()],
);

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonLike(data: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

describe("isAuditReport", () => {
  it("accepts a well-formed AuditReport with a null proof", () => {
    expect(isAuditReport(REPORT)).toBe(true);
  });

  it("accepts a proof block", () => {
    expect(isAuditReport({ ...REPORT, proof: { mimeType: "image/png", dataBase64: "iVBORw0KGgo=" } })).toBe(true);
  });

  it("rejects a report missing analyst_impacts", () => {
    const rest = { ...REPORT };
    delete (rest as { analyst_impacts?: unknown }).analyst_impacts;
    expect(isAuditReport(rest)).toBe(false);
  });

  it("rejects a report with a malformed proof", () => {
    expect(isAuditReport({ ...REPORT, proof: { mimeType: 1 } })).toBe(false);
  });

  it("rejects a non-object", () => {
    expect(isAuditReport(null)).toBe(false);
  });
});

describe("submitTranslate", () => {
  it("POSTs the scan to /api/translate and returns the AuditReport on 200", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonLike(REPORT, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitTranslate(SCAN);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.scanId).toBe(SCAN.scanId);
    }
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/translate",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scan: SCAN }),
      }),
    );
  });

  it("returns a typed failure when the response is not an AuditReport", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonLike(SCAN, 200));
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitTranslate(SCAN);

    if (result.ok) {
      throw new Error("expected a typed failure");
    }
    expect(result.code).toBe("translate_error");
  });

  it("passes through a 503 rate_limited envelope", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonLike({ code: "rate_limited", message: "Rate limited.", stage: "translate" }, 503),
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitTranslate(SCAN);

    if (result.ok) {
      throw new Error("expected a typed failure");
    }
    expect(result.code).toBe("rate_limited");
    expect(result.status).toBe(503);
  });

  it("reports unreachable when the fetch itself throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));

    const result = await submitTranslate(SCAN);

    if (result.ok) {
      throw new Error("expected a typed failure");
    }
    expect(result.code).toBe("translate_error");
    expect(result.status).toBe(0);
  });

  it("reports unreadable when the response is not JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError("bad json");
      },
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    const result = await submitTranslate(SCAN);

    if (result.ok) {
      throw new Error("expected a typed failure");
    }
    expect(result.code).toBe("translate_error");
  });
});