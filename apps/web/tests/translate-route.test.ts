// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let route: typeof import("@/app/api/translate/route");

const SCAN = {
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
  proof: null,
};

function chatResponse(content: unknown, status = 200) {
  return new Response(JSON.stringify(content), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const ANALYST_BODY = {
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            violation_id: "color-contrast",
            business_problem: "Text is unreadable.",
            affected_segment: "Low-vision users.",
            wcag_consequence: "WCAG 1.4.3 contrast.",
            conversion_impact_estimate: "Roughly 5% of sessions.",
          },
        ]),
      },
    },
  ],
};

const ARCHITECT_BODY = {
  choices: [
    {
      message: {
        content: JSON.stringify([
          {
            diff:
              "--- a/src/App.tsx\n+++ b/src/App.tsx\n@@ -1 +1 @@\n-<p className=\"text-slate-400\">Muted</p>\n+<p className=\"text-slate-600\">Muted</p>\n",
            rationale:
              "Raises text contrast to meet WCAG 1.4.3, addressing color-contrast.",
            wcag_rule: "WCAG 1.4.3",
          },
        ]),
      },
    },
  ],
};

beforeEach(async () => {
  vi.resetModules();
  route = await import("@/app/api/translate/route");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function callPost(body: string) {
  return route.POST(
    new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    }),
  );
}

describe("POST /api/translate", () => {
  it("runs Analyst then Architect and returns a full AuditReport", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse(ANALYST_BODY, 200))
      .mockResolvedValueOnce(chatResponse(ARCHITECT_BODY, 200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ scan: SCAN }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scanId).toBe(SCAN.scanId);
    expect(body.url).toBe(SCAN.url);
    expect(body.analyst_impacts).toHaveLength(1);
    expect((body as { analyst_impacts: unknown[] }).analyst_impacts[0]).toMatchObject({
      violation_id: "color-contrast",
    });
    expect(body.architect_patches).toHaveLength(1);
    expect((body as { architect_patches: unknown[] }).architect_patches[0]).toMatchObject({
      status: "proposed",
      wcag_rule: "WCAG 1.4.3",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns an empty-impact report with zero provider calls when nothing is high-severity", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const cleanScan = {
      ...SCAN,
      violations: [{ ...SCAN.violations[0], impact: "minor", id: "meta-viewport" }],
    };

    const res = await callPost(JSON.stringify({ scan: cleanScan }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as { analyst_impacts: unknown[]; architect_patches: unknown[] };
    expect(body.analyst_impacts).toEqual([]);
    expect(body.architect_patches).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps a provider 429 to a 503 rate_limited envelope", async () => {
    vi.stubEnv("A11Y_AI_MAX_RETRIES", "0");
    const fetchMock = vi.fn().mockResolvedValue(chatResponse({}, 429));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ scan: SCAN }));

    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({
      code: "rate_limited",
      stage: "translate",
    });
  });

  it("auto-retries a transient 429 and returns the audit report", async () => {
    vi.stubEnv("A11Y_AI_RETRY_BASE_MS", "0");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(chatResponse({}, 429))
      .mockResolvedValueOnce(chatResponse(ANALYST_BODY, 200))
      .mockResolvedValueOnce(chatResponse(ARCHITECT_BODY, 200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ scan: SCAN }));

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.scanId).toBe(SCAN.scanId);
    expect((body as { architect_patches: unknown[] }).architect_patches).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("maps a malformed provider body to a 502 translate_error envelope", async () => {
    const fetchMock = vi.fn().mockResolvedValue(chatResponse({ choices: [] }, 200));
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ scan: SCAN }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toMatchObject({ code: "translate_error", stage: "translate" });
  });

  it("returns 400 for a non-JSON body", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost("not json");

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "invalid_scan" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns 400 for a body that is not a ScanResult", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const res = await callPost(JSON.stringify({ scan: { url: "https://example.com" } }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ code: "invalid_scan" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});