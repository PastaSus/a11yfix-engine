// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  TranslateError,
  translateAnalyst,
} from "@/lib/translate/analyst";
import type { ScanResult } from "@/lib/scan";

const SCAN: ScanResult = {
  schemaVersion: "1.0.0",
  scanId: "01J123456789ABCDEFGHJKLMNP",
  url: "https://example.com",
  violations: [
    {
      id: "button-name",
      impact: "serious",
      description: "Buttons must have discernible text",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.11/button-name",
      nodes: [{ nodeId: "btn-1", coordinates: null }],
    },
    {
      id: "color-contrast",
      impact: "critical",
      description: "Elements must meet minimum color contrast",
      helpUrl: null,
      nodes: [{ nodeId: "hero", coordinates: { x: 0, y: 0, width: 800, height: 40 } }],
    },
    {
      id: "landmark-unique",
      impact: "moderate",
      description: "Ensures landmarks are unique",
      helpUrl: null,
      nodes: [{ nodeId: "nav", coordinates: null }],
    },
  ],
  vitals: { lcp: 2400, inp: 300, cls: 0.05 },
  timestamp: "2026-08-16T09:00:00.000Z",
};

function block(violationId: string, overrides: Record<string, unknown> = {}) {
  return {
    violation_id: violationId,
    business_problem: "Visitors who rely on assistive tech may find this page difficult to complete.",
    affected_segment: "Screen-reader and low-vision users.",
    wcag_consequence: `WCAG 2.2 AA ${violationId}: failure creates a barrier for affected users.`,
    conversion_impact_estimate: "roughly 1 in 20 affected visitors may abandon before converting.",
    ...overrides,
  };
}

function chatResponse(content: string, status = 200) {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status, headers: { "content-type": "application/json" } },
  );
}

function makeFake(mock: ReturnType<typeof vi.fn>) {
  return {
    fetch: mock as unknown as typeof globalThis.fetch,
    calls: () => mock.mock.calls as Array<[string, RequestInit]>,
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("translateAnalyst", () => {
  it("returns a schema-shaped AuditReport with one hedged block per high-severity violation", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );

    const report = await translateAnalyst(SCAN, { fetch: fake.fetch });

    expect(report.schemaVersion).toBe("1.0.0");
    expect(report.scanId).toBe(SCAN.scanId);
    expect(report.violations).toEqual(SCAN.violations);
    expect(report.vitals).toEqual(SCAN.vitals);
    expect(report.architect_patches).toEqual([]);
    expect(report.analyst_impacts.map((imp) => imp.violation_id)).toEqual([
      "color-contrast",
      "button-name",
    ]);
    for (const imp of report.analyst_impacts) {
      expect(imp.business_problem.trim()).not.toBe("");
      expect(imp.affected_segment.trim()).not.toBe("");
      expect(imp.wcag_consequence.trim()).not.toBe("");
      expect(imp.conversion_impact_estimate.trim()).not.toBe("");
      expect(imp.conversion_impact_estimate).toMatch(/plausibly|may|roughly/i);
    }
  });

  it("carries a populated proof block from the ScanResult into the AuditReport unchanged", async () => {
    const proof = { mimeType: "image/png", dataBase64: "iVBORw0KGgo=" };
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );

    const report = await translateAnalyst({ ...SCAN, proof }, { fetch: fake.fetch });

    expect(report.proof).toEqual(proof);
  });

  it("emits a null proof when the ScanResult carries no proof block", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );

    const report = await translateAnalyst(SCAN, { fetch: fake.fetch });

    expect(report.proof).toBeNull();
  });

  it("re-ranks the provider's blocks deterministically (critical before serious, then id)", async () => {
    const fake = makeFake(
      vi
        .fn()
        .mockResolvedValueOnce(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")])))
        .mockResolvedValueOnce(chatResponse(JSON.stringify([block("color-contrast"), block("button-name")]))),
    );

    const first = await translateAnalyst(SCAN, { fetch: fake.fetch });
    const second = await translateAnalyst(SCAN, { fetch: fake.fetch });

    expect(first.analyst_impacts.map((i) => i.violation_id)).toEqual(["color-contrast", "button-name"]);
    expect(second.analyst_impacts).toEqual(first.analyst_impacts);
  });

  it("resolves provider/model/key from env and sends the key as a bearer token", async () => {
    vi.stubEnv("A11Y_AI_PROVIDER", "https://mock.example/v1");
    vi.stubEnv("A11Y_AI_MODEL", "mock-chat");
    vi.stubEnv("A11Y_AI_KEY", "super-secret");
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );

    await translateAnalyst(SCAN, { fetch: fake.fetch });

    const [url, init] = fake.calls()[0];
    expect(url).toBe("https://mock.example/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer super-secret" });
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "mock-chat" });
  });

  it("instructs the provider to hedge and reply with a JSON array only in the system message", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );

    await translateAnalyst(SCAN, { fetch: fake.fetch });

    const [, init] = fake.calls()[0];
    const systemMessage = JSON.parse(String(init.body)).messages.find((m: { role: string }) => m.role === "system");
    expect(systemMessage.content).toMatch(/plausibly/);
    expect(systemMessage.content).toMatch(/may/);
    expect(systemMessage.content).toMatch(/JSON array only/);
  });

  it("uses free-tier defaults and stays keyless when env vars are unset", async () => {
    vi.stubEnv("A11Y_AI_PROVIDER", "");
    vi.stubEnv("A11Y_AI_MODEL", "");
    vi.stubEnv("A11Y_AI_KEY", "");
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );

    await translateAnalyst(SCAN, { fetch: fake.fetch });

    const [url, init] = fake.calls()[0];
    expect(url).toBe(`${DEFAULT_AI_PROVIDER}/chat/completions`);
    expect(JSON.parse(String(init.body))).toMatchObject({ model: DEFAULT_AI_MODEL });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("returns an empty analyst_impacts array and makes no provider call when there are no high-severity violations", async () => {
    const noHighSeverity = {
      ...SCAN,
      violations: SCAN.violations.filter((v) => v.impact === "moderate"),
    };
    const fake = makeFake(vi.fn());

    const report = await translateAnalyst(noHighSeverity, { fetch: fake.fetch });

    expect(report.analyst_impacts).toEqual([]);
    expect(report.violations).toEqual(noHighSeverity.violations);
    expect(report.architect_patches).toEqual([]);
    expect(fake.calls()).toHaveLength(0);
  });

  it("drops duplicate and unknown violation_ids while covering each high-severity violation exactly once", async () => {
    const withJunk = [
      block("button-name"),
      block("button-name", { business_problem: "duplicate" }),
      block("made-up-rule"),
      block("color-contrast"),
    ];
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse(JSON.stringify(withJunk))));

    const report = await translateAnalyst(SCAN, { fetch: fake.fetch });

    const ids = report.analyst_impacts.map((i) => i.violation_id);
    expect(ids).toEqual(["color-contrast", "button-name"]);
  });

  it("rejects with a rate_limited translate error on HTTP 429", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));

    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "rate_limited",
      stage: "translate",
    });
    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toBeInstanceOf(TranslateError);
  });

  it("rejects with a translate error when the provider is unreachable", async () => {
    const fake = makeFake(vi.fn().mockRejectedValue(new Error("connect refused")));

    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "translate_error",
      stage: "translate",
    });
  });

  it("rejects with a translate error when the provider returns a non-JSON body", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 200 })));

    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error on non-429 4xx-5xx statuses", async () => {
    for (const status of [400, 500, 503]) {
      const fake = makeFake(vi.fn().mockResolvedValue(new Response("{}", { status })));
      await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
    }
  });

  it("rejects with a translate error when the content is not a JSON array", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse("sure, here it is: { not json")));

    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when a block is missing a required field", async () => {
    const incomplete = block("button-name", { affected_segment: "" });
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse(JSON.stringify([incomplete, block("color-contrast")]))));

    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when a high-severity violation is absent from the response", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name")]))));

    await expect(translateAnalyst(SCAN, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error on an invalid scan result without calling the provider", async () => {
    const fake = makeFake(vi.fn());

    await expect(translateAnalyst(null as unknown as ScanResult, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "translate_error",
      stage: "translate",
    });
    await expect(translateAnalyst(null as unknown as ScanResult, { fetch: fake.fetch })).rejects.toBeInstanceOf(
      TranslateError,
    );
    await expect(
      translateAnalyst({ ...SCAN, violations: undefined as unknown as never[] }, { fetch: fake.fetch }),
    ).rejects.toMatchObject({ code: "translate_error", stage: "translate" });
    expect(fake.calls()).toHaveLength(0);
  });

  it("records and logs translate-stage start/end/duration keyed by scanId", async () => {
    const times = [100, 150];
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([block("button-name"), block("color-contrast")]))),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await translateAnalyst(SCAN, { fetch: fake.fetch, now: () => times.shift() ?? 0 });

    const startCall = logSpy.mock.calls.find((args) => args[0] === "[darkhouse] translate start");
    const endCall = logSpy.mock.calls.find((args) => args[0] === "[darkhouse] translate end");
    expect(startCall?.[1]).toMatchObject({ scanId: SCAN.scanId });
    expect(endCall?.[1]).toMatchObject({ scanId: SCAN.scanId, durationMs: 50, analystImpacts: 2 });
  });
});
