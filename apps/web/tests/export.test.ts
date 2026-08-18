import { afterEach, describe, expect, it, vi } from "vitest";
import { exportFilename, hostnameOf, renderReportHtml, triggerExport } from "@/lib/export";
import { makeImpact, makeReport, makeViolation } from "@/tests/fixtures";

const NATIVE_ANCHOR_CLICK = Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype, "click");

afterEach(() => {
  vi.restoreAllMocks();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  if (NATIVE_ANCHOR_CLICK) {
    Object.defineProperty(HTMLAnchorElement.prototype, "click", NATIVE_ANCHOR_CLICK);
  } else {
    delete (HTMLAnchorElement.prototype as { click?: unknown }).click;
  }
});

const HAPPY_REPORT = makeReport(
  [
    makeViolation("critical", "v-c1"),
    makeViolation("serious", "v-c2"),
    makeViolation("moderate", "v-m1"),
    makeViolation("minor", "v-mi1"),
  ],
  [
    makeImpact("v-c1", {
      business_problem: "Checkout forms lose entered data when a field fails validation.",
      affected_segment:
        "Customers on the product and checkout pages, roughly a quarter of mobile sessions.",
      wcag_consequence:
        "Fails WCAG 3.3.3 Error Suggestion; screen reader users may resubmit or abandon the purchase.",
      conversion_impact_estimate:
        "This plausibly blocks a meaningful share of checkout completions each month.",
    }),
    makeImpact("v-c2", {
      business_problem: "Keyboard users cannot reach the cart summary without tabbing through every link.",
      affected_segment:
        "Keyboard-dependent shoppers on the global navigation across all product pages.",
      wcag_consequence: "Fails WCAG 2.1.1 Keyboard; a segment of users cannot start the checkout flow.",
      conversion_impact_estimate:
        "This plausibly leaks a share of otherwise-qualified checkout sessions.",
    }),
  ],
);

describe("exportFilename", () => {
  it("FILE_NAME: derives the hostname-slug and ISO date from the report", () => {
    expect(exportFilename(makeReport([]))).toBe(
      "darkhouse-report-example-com-2026-08-15.html",
    );
  });

  it("slugs multi-segment hostnames and ignores the path and port", () => {
    const report = { ...makeReport([]), url: "https://app.example.co.uk:8443/docs/index.html" };
    expect(exportFilename(report)).toBe(
      "darkhouse-report-app-example-co-uk-2026-08-15.html",
    );
  });
});

describe("hostnameOf", () => {
  it("strips the port on default- and non-default-port URLs", () => {
    expect(hostnameOf("https://example.com:443/docs")).toBe("example.com");
    expect(hostnameOf("https://app.example.co.uk:8443/docs/index.html")).toBe("app.example.co.uk");
  });

  it("falls back to the shared site hostname on non-parsing input, dropping ports", () => {
    expect(hostnameOf("not-a-url")).toBe("site");
    expect(hostnameOf("https://example.com:99999")).toBe("example.com");
  });

  it("agrees with the hostname embedded in exportFilename", () => {
    const report = { ...makeReport([]), url: "https://app.example.co.uk:8443/docs/index.html" };
    const slug = hostnameOf(report.url).replace(/\./g, "-");
    expect(exportFilename(report)).toBe(`darkhouse-report-${slug}-2026-08-15.html`);
  });
});

describe("renderReportHtml", () => {
  it("HAPPY_PATH: composes a standalone HTML document with severity block, priority list, and scan metadata", () => {
    const html = renderReportHtml(HAPPY_REPORT);

    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toMatch(/<html lang="en">/);
    expect(html).toContain("<style>");
    expect(html).toContain(":root");
    expect(html).toContain("https://fonts.googleapis.com/css2?family=Space+Grotesk");
    expect(html).toContain("family=Geist");
    expect(html).toContain("family=Geist+Mono");
    expect(html).toContain("</html>");

    // Severity metric block: business-phrase aria-labels, tinted tiles, tabular figures.
    expect(html).toContain('aria-label="2 critical issues"');
    expect(html).toContain('aria-label="1 moderate issue"');
    expect(html).toContain('aria-label="1 minor issue"');
    expect(html).toContain("tile-critical");
    expect(html).toContain("tile-moderate");
    expect(html).toContain("tile-minor");
    expect(html).toContain("metric-figure");
    expect(html).toContain("tabular-nums");

    // Priority list renders all four AnalystImpact fields verbatim in order.
    expect(html).toContain("Checkout forms lose entered data when a field fails validation.");
    expect(html).toContain(
      "Customers on the product and checkout pages, roughly a quarter of mobile sessions.",
    );
    expect(html).toContain(
      "Fails WCAG 3.3.3 Error Suggestion; screen reader users may resubmit or abandon the purchase.",
    );
    expect(html).toContain(
      "This plausibly blocks a meaningful share of checkout completions each month.",
    );
    expect(html).toContain(
      "Keyboard users cannot reach the cart summary without tabbing through every link.",
    );
    expect(html).toContain('<ol class="priority">');
    expect(html.match(/<li>/g)).toHaveLength(2);

    // Scan metadata: URL, scan date, health label.
    expect(html).toContain("https://example.com");
    expect(html).toContain("Scanned Aug 15, 2026");
    expect(html).toContain("<span class=\"chip chip-critical\">2 critical issues</span>");
  });

  it("HAPPY_PATH: the export is the Client View as a file — no Developer vocabulary", () => {
    const html = renderReportHtml(HAPPY_REPORT);
    expect(html).not.toContain("v-c1");
    expect(html).not.toContain("v-c2");
    expect(html).not.toContain("v-m1");
    expect(html).not.toContain("helpUrl");
    expect(html).not.toContain("dequeuniversity");
    expect(html).not.toContain("button-name");
  });

  it("ALL_PASS: zero figures, the restrained no-critical register, no priority list", () => {
    const html = renderReportHtml(makeReport([], []));
    expect(html).toContain('aria-label="0 critical issues"');
    expect(html).toContain('aria-label="0 moderate issues"');
    expect(html).toContain('aria-label="0 minor issues"');
    expect(html).toContain(
      "No critical violations detected. Check the Developer view for the full report.",
    );
    expect(html).toContain("<span class=\"chip chip-conforming\">No critical issues</span>");
    expect(html).not.toContain("<ol");
    expect(html).not.toContain("Impact analysis unavailable");
  });

  it("NO_IMPACTS: critical counts render with an availability note, no priority list, no false-clean register", () => {
    const report = makeReport([makeViolation("critical", "v-c1"), makeViolation("serious", "v-c2")], []);
    const html = renderReportHtml(report);
    expect(html).toContain('aria-label="2 critical issues"');
    expect(html).toContain("Impact analysis unavailable. Check the Developer view for the full report.");
    expect(html).not.toContain("No critical violations detected.");
    expect(html).not.toContain("<ol");
  });

  it("EXPORT_WITH_PROOF: embeds a populated proof as a decodable base64 data-URI image in a proof card", () => {
    const sourceBase64 = "iVBORw0KGgo="; // base64 of the 8-byte PNG signature \x89PNG\r\n\x1a\n
    const report = makeReport(
      [makeViolation("critical", "v-c1")],
      [makeImpact("v-c1")],
      [],
      { mimeType: "image/png", dataBase64: sourceBase64 },
    );
    const html = renderReportHtml(report);
    expect(html).toContain('<section class="card proof">');
    expect(html).toContain(`<img src="data:image/png;base64,${sourceBase64}"`);
    expect(html).toContain('alt="Broken experience on example.com"');
    // The embedded base64 must round-trip to the source PNG bytes.
    const embedded = html.match(/src="data:image\/png;base64,([A-Za-z0-9+/=]+)"/)?.[1];
    expect(embedded).toBe(sourceBase64);
    expect(Uint8Array.from(atob(embedded!), (c) => c.charCodeAt(0))).toEqual(
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  });

  it("EXPORT_WITH_PROOF: omits the proof section when the proof mimeType is not image/png", () => {
    const report = makeReport(
      [makeViolation("critical", "v-c1")],
      [makeImpact("v-c1")],
      [],
      { mimeType: "text/html", dataBase64: "SGVsbG8gd29ybGQ=" },
    );
    const html = renderReportHtml(report);
    expect(html).not.toContain('<section class="card proof">');
    expect(html).not.toContain("data:text/html;base64,");
  });

  it("EXPORT_WITH_PROOF: omits the proof section for empty, too-short, or non-base64 data", () => {
    const reports = [
      makeReport([makeViolation("critical", "v-c1")], [], [], {
        mimeType: "image/png",
        dataBase64: "",
      }),
      makeReport([makeViolation("critical", "v-c1")], [], [], {
        mimeType: "image/png",
        dataBase64: "short",
      }),
      makeReport([makeViolation("critical", "v-c1")], [], [], {
        mimeType: "image/png",
        dataBase64: "not=a-valid=base64==",
      }),
    ];
    for (const report of reports) {
      const html = renderReportHtml(report);
      expect(html).not.toContain("card proof");
      expect(html).not.toContain("data:image/png;base64,");
    }
  });

  it("EXPORT_WITH_PROOF: omits the proof section for a non-object proof", () => {
    const report = {
      ...makeReport([makeViolation("critical", "v-c1")], [makeImpact("v-c1")]),
      proof: "not-an-object" as unknown as null,
    };
    const html = renderReportHtml(report);
    expect(html).not.toContain("card proof");
    expect(html).not.toContain("data:image/png;base64,");
  });

  it("EXPORT_NO_PROOF: a null proof omits the proof section and keeps all 4-1 sections intact", () => {
    const html = renderReportHtml(HAPPY_REPORT);
    expect(html).not.toContain("card proof");
    expect(html).not.toContain("data:image/png");
    expect(html).toContain('aria-label="2 critical issues"');
    expect(html).toContain('<ol class="priority">');
    expect(html).toContain("Scanned Aug 15, 2026");
  });

  it("ALL_PASS: a zero high-severity report with proof null still exports without the proof section", () => {
    const html = renderReportHtml(makeReport([], []));
    expect(html).not.toContain("card proof");
    expect(html).not.toContain("data:image/png");
    expect(html).toContain(
      "No critical violations detected. Check the Developer view for the full report.",
    );
    expect(html).toContain('<span class="chip chip-conforming">No critical issues</span>');
  });

  it("no-Developer-vocabulary still holds with a proof present", () => {
    const report = {
      ...HAPPY_REPORT,
      proof: { mimeType: "image/png", dataBase64: "iVBORw0KGgoAAAANSUhEUgAAAA==" },
    };
    const html = renderReportHtml(report);
    expect(html).not.toContain("v-c1");
    expect(html).not.toContain("v-c2");
    expect(html).not.toContain("helpUrl");
    expect(html).not.toContain("dequeuniversity");
    expect(html).not.toContain("button-name");
    expect(html).toContain('<section class="card proof">');
  });

  it("escapes data text so the file stays valid standalone HTML", () => {
    const report = makeReport([makeViolation("critical", "v-esc")], [
      makeImpact("v-esc", {
        business_problem: '<script>alert("boom")</script> & "quoted"',
      }),
    ]);
    const html = renderReportHtml(report);
    expect(html).toContain(
      "&lt;script&gt;alert(&quot;boom&quot;)&lt;/script&gt; &amp; &quot;quoted&quot;",
    );
    expect(html).not.toContain("<script>alert");
  });
});

describe("triggerExport", () => {
  it("creates a Blob, anchors a download, clicks, and revokes the object URL", async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:export-test");
    const revokeObjectURL = vi.fn();
    const anchorClick = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: anchorClick,
    });

    const createElement = vi.spyOn(document, "createElement");
    const appendChild = vi.spyOn(document.body, "appendChild");
    const html = "<!DOCTYPE html><html></html>";
    const filename = "darkhouse-report-example-com-2026-08-15.html";

    triggerExport(html, filename);

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    await expect(blob.text()).resolves.toBe(html);

    expect(createElement).toHaveBeenCalledWith("a");
    const anchor = appendChild.mock.calls[0][0] as HTMLAnchorElement;
    expect(anchor.tagName).toBe("A");
    expect(anchor.download).toBe(filename);
    expect(anchor.href).toBe("blob:export-test");
    expect(anchorClick).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export-test");
  });

  it("revokes the object URL even when the anchor click throws (no leak)", () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => "blob:export-test");
    const revokeObjectURL = vi.fn();
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: vi.fn(() => {
        throw new Error("click blocked");
      }),
    });
    const appendChild = vi.spyOn(document.body, "appendChild");
    const html = "<!DOCTYPE html><html></html>";
    const filename = "darkhouse-report-example-com-2026-08-15.html";

    expect(() => triggerExport(html, filename)).toThrow("click blocked");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export-test");
    expect(appendChild).toHaveBeenCalledTimes(1);
  });
});