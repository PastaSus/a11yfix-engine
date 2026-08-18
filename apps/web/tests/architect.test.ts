// @vitest-environment node

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_AI_MODEL,
  DEFAULT_AI_PROVIDER,
  MAX_PATCH_TOKENS,
  TranslateError,
  translateArchitect,
} from "@/lib/translate/architect";
import type { AuditReport } from "@/lib/translate/architect";

const REPORT: AuditReport = {
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
  analyst_impacts: [
    {
      violation_id: "color-contrast",
      business_problem: "Low-contrast text may be unreadable for many visitors.",
      affected_segment: "Low-vision and older users.",
      wcag_consequence: "WCAG 2.2 AA 1.4.3: insufficient contrast between text and background.",
      conversion_impact_estimate: "roughly 1 in 20 affected visitors may abandon before converting.",
    },
    {
      violation_id: "button-name",
      business_problem: "Buttons without text may be unusable for assistive-tech users.",
      affected_segment: "Screen-reader users.",
      wcag_consequence: "WCAG 2.2 AA 4.1.2: interactive controls lack an accessible name.",
      conversion_impact_estimate: "plausibly a small share of affected users cannot submit forms.",
    },
  ],
  architect_patches: [],
};

function patch(violationId: string, overrides: Record<string, unknown> = {}) {
  return {
    diff: [
      "--- a/src/app/components/card.tsx",
      "+++ b/src/app/components/card.tsx",
      "@@ -1,3 +1,4 @@",
      `-  // ${violationId}: low-contrast text`,
      "+  // fixed contrast",
    ].join("\n"),
    rationale: `Fix ${violationId} so it meets WCAG 1.4.3.`,
    wcag_rule: "1.4.3",
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

describe("translateArchitect", () => {
  it("returns the audit report with one proposed patch per impact in the same order", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    const report = await translateArchitect(REPORT, { fetch: fake.fetch });

    expect(report.schemaVersion).toBe("1.0.0");
    expect(report.scanId).toBe(REPORT.scanId);
    expect(report.violations).toEqual(REPORT.violations);
    expect(report.vitals).toEqual(REPORT.vitals);
    expect(report.analyst_impacts).toEqual(REPORT.analyst_impacts);
    expect(report.architect_patches.map((p) => p.rationale.match(/button-name|color-contrast/g)?.[0])).toEqual([
      "color-contrast",
      "button-name",
    ]);
    for (const p of report.architect_patches) {
      expect(p.status).toBe("proposed");
      expect(p.diff).toMatch(/^\+[^+]/m);
      expect(p.diff).toMatch(/^-[^-]/m);
      expect(p.rationale.trim()).not.toBe("");
      expect(p.rationale).toMatch(/\bWCAG\b/i);
      expect(p.wcag_rule.trim()).not.toBe("");
    }
  });

  it("preserves the proof block through the returned audit report", async () => {
    const proof = { mimeType: "image/png", dataBase64: "iVBORw0KGgo=" };
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    const report = await translateArchitect({ ...REPORT, proof }, { fetch: fake.fetch });

    expect(report.proof).toEqual(proof);
    expect(report.architect_patches.map((p) => p.rationale.match(/button-name|color-contrast/g)?.[0])).toEqual([
      "color-contrast",
      "button-name",
    ]);
  });

  it("stamps status proposed from a constant and drops any provider-returned status", async () => {
    const fake = makeFake(
      vi
        .fn()
        .mockResolvedValue(
          chatResponse(
            JSON.stringify([patch("color-contrast", { status: "applied" }), patch("button-name", { status: "merged" })]),
          ),
        ),
    );

    const report = await translateArchitect(REPORT, { fetch: fake.fetch });

    for (const p of report.architect_patches) {
      expect(p.status).toBe("proposed");
      expect(Object.keys(p).sort()).toEqual(["diff", "rationale", "status", "wcag_rule"]);
    }
  });

  it("returns identical architect_patches for the same valid report twice", async () => {
    const fake = makeFake(
      vi
        .fn()
        .mockResolvedValueOnce(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")])))
        .mockResolvedValueOnce(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    const first = await translateArchitect(REPORT, { fetch: fake.fetch });
    const second = await translateArchitect(REPORT, { fetch: fake.fetch });

    expect(second.architect_patches).toEqual(first.architect_patches);
  });

  it("resolves provider/model/key from env and sends the patch token budget", async () => {
    vi.stubEnv("A11Y_AI_PROVIDER", "https://mock.example/v1");
    vi.stubEnv("A11Y_AI_MODEL", "mock-chat");
    vi.stubEnv("A11Y_AI_KEY", "super-secret");
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    await translateArchitect(REPORT, { fetch: fake.fetch });

    const [url, init] = fake.calls()[0];
    expect(url).toBe("https://mock.example/v1/chat/completions");
    expect(init.headers).toMatchObject({ Authorization: "Bearer super-secret" });
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "mock-chat", max_tokens: MAX_PATCH_TOKENS });
  });

  it("uses free-tier defaults and stays keyless when env vars are unset", async () => {
    vi.stubEnv("A11Y_AI_PROVIDER", "");
    vi.stubEnv("A11Y_AI_MODEL", "");
    vi.stubEnv("A11Y_AI_KEY", "");
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    await translateArchitect(REPORT, { fetch: fake.fetch });

    const [url, init] = fake.calls()[0];
    expect(url).toBe(`${DEFAULT_AI_PROVIDER}/chat/completions`);
    expect(JSON.parse(String(init.body))).toMatchObject({ model: DEFAULT_AI_MODEL });
    expect(init.headers).not.toHaveProperty("Authorization");
  });

  it("returns empty architect_patches and makes no provider call when there are no impacts", async () => {
    const noImpacts = { ...REPORT, analyst_impacts: [] };
    const fake = makeFake(vi.fn());

    const report = await translateArchitect(noImpacts, { fetch: fake.fetch });

    expect(report.architect_patches).toEqual([]);
    expect(report.violations).toEqual(noImpacts.violations);
    expect(fake.calls()).toHaveLength(0);
  });

  it("instructs git-style unified-diff output and one patch per violation in order", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    await translateArchitect(REPORT, { fetch: fake.fetch });

    const [, init] = fake.calls()[0];
    const body = JSON.parse(String(init.body));
    const systemMessage = body.messages.find((m: { role: string }) => m.role === "system");
    const userMessage = body.messages.find((m: { role: string }) => m.role === "user");
    expect(systemMessage.content).toMatch(/git-style unified diff/);
    expect(systemMessage.content).toMatch(/exact same order/);
    expect(systemMessage.content).toMatch(/JSON array only/);
    expect(userMessage.content).toMatch(/exactly 2 objects/);
    expect(userMessage.content).toMatch(/same order/);
  });

  it("rejects with a rate_limited translate error on HTTP 429", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(new Response("{}", { status: 429 })));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "rate_limited",
      stage: "translate",
    });
    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toBeInstanceOf(TranslateError);
  });

  it("rejects with a translate error when the provider is unreachable", async () => {
    const fake = makeFake(vi.fn().mockRejectedValue(new Error("connect refused")));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "translate_error",
      stage: "translate",
    });
  });

  it("rejects with a translate error and the timeout message when the provider times out", async () => {
    const fake = makeFake(vi.fn().mockRejectedValue(new DOMException("", "TimeoutError")));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "translate_error",
      stage: "translate",
    });
    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ message: /timed out/i });
    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toBeInstanceOf(TranslateError);
  });

  it("rejects with a translate error when the JSON array cannot be parsed", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse("[not json]")));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when the provider returns no usable content", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [] }), { status: 200 })),
    );

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("normalizes a provider URL with trailing slashes to a single-slash endpoint", async () => {
    vi.stubEnv("A11Y_AI_PROVIDER", "https://mock.example/v1///");
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );

    await translateArchitect(REPORT, { fetch: fake.fetch });

    const [url] = fake.calls()[0];
    expect(url).toBe("https://mock.example/v1/chat/completions");
  });

  it("rejects with a translate error when the provider returns a non-JSON body", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(new Response("<html>oops</html>", { status: 200 })));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when the content is not a JSON array", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse("sure, here it is: { not json")));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when a patch is missing a required field", async () => {
    const incomplete = patch("color-contrast", { wcag_rule: "" });
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse(JSON.stringify([incomplete, patch("button-name")]))));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when a diff has no +/- content lines", async () => {
    const noContentDiff = patch("color-contrast", {
      diff: ["--- a/src/app/components/card.tsx", "+++ b/src/app/components/card.tsx", "@@ -1,3 +1,4 @@", "  unchanged"].join(
        "\n",
      ),
    });
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([noContentDiff, patch("button-name")]))),
    );

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when a rationale does not reference the violation id", async () => {
    const noId = patch("color-contrast", { rationale: "Increase text contrast to meet WCAG 1.4.3." });
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse(JSON.stringify([noId, patch("button-name")]))));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when a prioritized violation is absent from the response", async () => {
    const fake = makeFake(vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast")]))));

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when patches are returned out of order", async () => {
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("button-name"), patch("color-contrast")]))),
    );

    await expect(translateArchitect(REPORT, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
  });

  it("rejects with a translate error when an impact references no matching scan violation", async () => {
    const badReport = {
      ...REPORT,
      analyst_impacts: [...REPORT.analyst_impacts, { ...REPORT.analyst_impacts[0], violation_id: "ghost-rule" }],
    };
    const fake = makeFake(vi.fn());

    await expect(translateArchitect(badReport, { fetch: fake.fetch })).rejects.toMatchObject({ code: "translate_error" });
    expect(fake.calls()).toHaveLength(0);
  });

  it("rejects with a translate error on an invalid audit report", async () => {
    const fake = makeFake(vi.fn());

    await expect(translateArchitect(null as unknown as AuditReport, { fetch: fake.fetch })).rejects.toMatchObject({
      code: "translate_error",
    });
    await expect(translateArchitect({ ...REPORT, analyst_impacts: undefined as unknown as never[] }, { fetch: fake.fetch }))
      .rejects.toMatchObject({ code: "translate_error" });
    expect(fake.calls()).toHaveLength(0);
  });

  it("records and logs translate-stage start/end/duration keyed by scanId", async () => {
    const times = [100, 150];
    const fake = makeFake(
      vi.fn().mockResolvedValue(chatResponse(JSON.stringify([patch("color-contrast"), patch("button-name")]))),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    await translateArchitect(REPORT, { fetch: fake.fetch, now: () => times.shift() ?? 0 });

    const startCall = logSpy.mock.calls.find((args) => args[0] === "[darkhouse] translate start");
    const endCall = logSpy.mock.calls.find((args) => args[0] === "[darkhouse] translate end");
    expect(startCall?.[1]).toMatchObject({ scanId: REPORT.scanId });
    expect(endCall?.[1]).toMatchObject({ scanId: REPORT.scanId, durationMs: 50, architectPatches: 2 });
  });
});
