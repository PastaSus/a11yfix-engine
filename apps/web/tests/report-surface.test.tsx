import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReportSurface } from "@/components/report-surface";
import { AUDIENCE_STORAGE_KEY } from "@/components/audience-toggle";
import { severityTier } from "@/lib/severity";
import type { Violation } from "@/lib/scan";
import { makeImpact, makePatch, makeReport, makeViolation } from "@/tests/fixtures";

const NATIVE_SCROLL_INTO_VIEW = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);

// Captured at module load so the export-flow tests can stub the anchor click
// and restore it afterward (mirrors the pattern used in `export.test.ts`).
const NATIVE_ANCHOR_CLICK = Object.getOwnPropertyDescriptor(
  HTMLAnchorElement.prototype,
  "click",
);

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
  delete (URL as { createObjectURL?: unknown }).createObjectURL;
  delete (URL as { revokeObjectURL?: unknown }).revokeObjectURL;
  if (NATIVE_ANCHOR_CLICK) {
    Object.defineProperty(HTMLAnchorElement.prototype, "click", NATIVE_ANCHOR_CLICK);
  } else {
    delete (HTMLAnchorElement.prototype as { click?: unknown }).click;
  }
  if (NATIVE_SCROLL_INTO_VIEW) {
    Object.defineProperty(Element.prototype, "scrollIntoView", NATIVE_SCROLL_INTO_VIEW);
  } else {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

const EMPTY_REPORT = makeReport([]);

/**
 * Locates a severity count chip by its combined visible phrase ("2 Critical").
 * A chip renders its tabular number and severity label as distinct sibling
 * text (per DESIGN.md: large tabular numbers with text labels), so no single
 * element's own text node equals the combined phrase — match on the chip's
 * full descendant text instead. Ancestors always contain more text than the
 * phrase, so this resolves to the chip uniquely.
 */
function countChip(phrase: string): HTMLElement {
  return screen.getByText((_, element) => {
    if (!element) return false;
    return element.textContent?.replace(/\s+/g, " ").trim() === phrase;
  });
}

/**
 * Stubs the browser download seam (`URL.createObjectURL` → anchor download →
 * `URL.revokeObjectURL`) that `triggerExport` exercises, exactly as
 * `export.test.ts` does. Returns the mocks so the test can assert each call.
 */
function stubDownload(): {
  createObjectURL: ReturnType<typeof vi.fn>;
  revokeObjectURL: ReturnType<typeof vi.fn>;
} {
  const createObjectURL = vi.fn(() => "blob:export-test");
  const revokeObjectURL = vi.fn();
  URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
  URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
  Object.defineProperty(HTMLAnchorElement.prototype, "click", {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  return { createObjectURL, revokeObjectURL };
}

describe("severityTier", () => {
  it("folds critical and serious into Critical and keeps moderate/minor one-to-one", () => {
    expect(severityTier("critical")).toBe("critical");
    expect(severityTier("serious")).toBe("critical");
    expect(severityTier("moderate")).toBe("moderate");
    expect(severityTier("minor")).toBe("minor");
  });

  it("lands an out-of-vocabulary impact on the visible moderate tier instead of dropping it", () => {
    expect(severityTier("impact-none" as Violation["impact"])).toBe("moderate");
  });
});

describe("ReportSurface", () => {
  it("HAPPY_PATH: header shows URL, scan date, health chip, frozen counts, and a labelled Export button", () => {
    const report = makeReport([
      makeViolation("critical", "v1"),
      makeViolation("serious", "v2"),
      makeViolation("moderate", "v3"),
      makeViolation("moderate", "v4"),
      makeViolation("minor", "v5"),
    ]);
    render(<ReportSurface report={report} />);

    expect(screen.getByRole("heading", { name: report.url })).not.toBeNull();
    expect(screen.getByText("Scanned")).not.toBeNull();
    expect(screen.getByText(/Aug 15, 2026/)).not.toBeNull();
    const criticalChip = countChip("2 Critical");
    expect(within(criticalChip).getByText("2")).not.toBeNull();
    expect(within(criticalChip).getByText("Critical")).not.toBeNull();
    expect(criticalChip.className).toContain("bg-critical-container");
    const moderateChip = countChip("2 Moderate");
    expect(within(moderateChip).getByText("Moderate")).not.toBeNull();
    expect(moderateChip.className).toContain("bg-moderate-container");
    const minorChip = countChip("1 Minor");
    expect(within(minorChip).getByText("1")).not.toBeNull();
    expect(within(minorChip).getByText("Minor")).not.toBeNull();
    expect(minorChip.className).toContain("bg-minor-container");
    expect(screen.getByText("2 critical issues")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Export report" })).not.toBeNull();
  });

  it("ALL_PASS: zero counts and a conforming health chip in the no-critical register", () => {
    render(<ReportSurface report={EMPTY_REPORT} />);
    expect(countChip("0 Critical")).not.toBeNull();
    expect(countChip("0 Moderate")).not.toBeNull();
    expect(countChip("0 Minor")).not.toBeNull();
    expect(screen.getByText("No critical issues")).not.toBeNull();
    expect(screen.queryByText(/all good/i)).toBeNull();
  });

  it("STICKY_SESSION: a Developer choice survives a remount in the same session", () => {
    render(<ReportSurface report={EMPTY_REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    expect(screen.getByLabelText("Developer view")).not.toBeNull();
    expect(screen.queryByLabelText("Client view")).toBeNull();

    cleanup();
    render(<ReportSurface report={EMPTY_REPORT} />);
    expect(screen.getByLabelText("Developer view")).not.toBeNull();
    expect(screen.queryByLabelText("Client view")).toBeNull();
  });

  it("NO_RESCAN: rendering and toggling never call fetch or re-scan", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportSurface report={EMPTY_REPORT} />);
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    fireEvent.click(screen.getByRole("button", { name: "Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Export report" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("renders the Client view by default and switches to Developer instantly", () => {
    render(<ReportSurface report={EMPTY_REPORT} />);
    expect(screen.getByLabelText("Client view")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    expect(screen.getByLabelText("Developer view")).not.toBeNull();
    expect(screen.queryByLabelText("Client view")).toBeNull();
  });

  it("VIEW_FIX_TOGGLE: a view-fix press announces the Developer option active and persists to sessionStorage", () => {
    const report = makeReport([makeViolation("critical", "v1")], [makeImpact("v1")]);
    render(<ReportSurface report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "View fix: Human problem for v1." }));
    expect(screen.getByRole("button", { name: "Developer" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByLabelText("Developer view")).not.toBeNull();
    expect(window.sessionStorage.getItem(AUDIENCE_STORAGE_KEY)).toBe("developer");
  });

  it("VIEW_FIX_STICKY: a view-fix-presumed Developer choice survives a remount exactly like a toggle press", () => {
    const report = makeReport([makeViolation("critical", "v1")], [makeImpact("v1")]);
    render(<ReportSurface report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "View fix: Human problem for v1." }));
    cleanup();
    render(<ReportSurface report={report} />);
    expect(screen.getByLabelText("Developer view")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Developer" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("VIEW_FIX_SEAM: the pending id is consumed once and then cleared from the surface state", () => {
    const report = makeReport([makeViolation("critical", "v1")], [makeImpact("v1")]);
    const { container } = render(<ReportSurface report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "View fix: Human problem for v1." }));
    expect(container.querySelector("[data-pending-view-fix]")).toBeNull();
  });

  it("DEVELOPER_VIEW: toggling to Developer renders the real Developer View content", () => {
    const report = makeReport(
      [makeViolation("critical", "v1"), makeViolation("moderate", "v2")],
      [],
      [makePatch()],
    );
    render(<ReportSurface report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    expect(screen.getByRole("heading", { name: "Violations" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Core Web Vitals" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Proposed fixes" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copy diff" })).not.toBeNull();
    expect(screen.getByText("WCAG 1.1.1")).not.toBeNull();
  });

  it("VIEW_FIX_SWITCH_FOCUS: a view-fix press switches audience and focuses the matching Developer row", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    const report = makeReport([makeViolation("critical", "v1")], [makeImpact("v1")]);
    const { container } = render(<ReportSurface report={report} />);
    fireEvent.click(screen.getByRole("button", { name: "View fix: Human problem for v1." }));

    const row = container.querySelector("[data-violation-row='v1']");
    expect(row).not.toBeNull();
    expect(document.activeElement).toBe(row);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "nearest" });
  });

  it("VIEW_FIX_NO_STALE_FOCUS: a manual Client → Developer toggle after a view-fix press never re-scrolls or re-focuses", () => {
    const scrollIntoView = vi.fn();
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    const report = makeReport([makeViolation("critical", "v1")], [makeImpact("v1")]);
    const { container } = render(<ReportSurface report={report} />);

    // The one user-initiated focus move: the view-fix press itself.
    fireEvent.click(screen.getByRole("button", { name: "View fix: Human problem for v1." }));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement?.getAttribute("data-violation-row")).toBe("v1");

    // Manually bounce Client → Developer; no stale id may drive a second move.
    fireEvent.click(screen.getByRole("button", { name: "Client" }));
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));

    const row = container.querySelector("[data-violation-row='v1']");
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(document.activeElement).not.toBe(row);

    // But a genuine second view-fix press on the same violation still focuses it.
    fireEvent.click(screen.getByRole("button", { name: "Client" }));
    fireEvent.click(screen.getByRole("button", { name: "View fix: Human problem for v1." }));
    expect(scrollIntoView).toHaveBeenCalledTimes(2);
    expect(document.activeElement?.getAttribute("data-violation-row")).toBe("v1");
  });

  it("shared countPhrase: the metric figure label matches the health chip phrase for the same report", () => {
    const report = makeReport(
      [
        makeViolation("critical", "v1"),
        makeViolation("serious", "v2"),
      ],
      [makeImpact("v1"), makeImpact("v2")],
    );
    render(<ReportSurface report={report} />);
    expect(screen.getByText("2 critical issues")).not.toBeNull();
    expect(screen.getByRole("group", { name: "2 critical issues" })).not.toBeNull();
  });

  it("severity is never color-only: counts and health carry explicit text labels", () => {
    const report = makeReport([makeViolation("critical", "v1")]);
    render(<ReportSurface report={report} />);
    const chip = countChip("1 Critical");
    expect(within(chip).getByText("1")).not.toBeNull();
    expect(within(chip).getByText("Critical")).not.toBeNull();
    expect(chip.className).toContain("bg-critical-container");
    expect(screen.getByText("1 critical issue")).not.toBeNull();
  });

  it("EXPORT_A11Y: Export is a native, labelled, focusable button (≥44px) that never calls fetch", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    stubDownload();
    render(<ReportSurface report={EMPTY_REPORT} />);
    const exportButton = screen.getByRole("button", { name: "Export report" });
    expect(exportButton.tagName).toBe("BUTTON");
    expect(exportButton.className).toContain("h-11");
    expect(exportButton.className).toContain("focus-visible:outline-2");
    fireEvent.click(exportButton);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("EXPORT_DOWNLOAD: clicking Export composes the report blob and downloads {hostname}-{date}.html", () => {
    const report = makeReport(
      [makeViolation("critical", "v-c1")],
      [
        makeImpact("v-c1", {
          business_problem: "Checkout forms lose entered data on a validation failure.",
          affected_segment: "Shoppers on the product and checkout pages.",
          wcag_consequence: "Fails WCAG 3.3.3 Error Suggestion; users may abandon the purchase.",
          conversion_impact_estimate: "Plausibly blocks a share of checkout completions.",
        }),
      ],
    );
    const { createObjectURL, revokeObjectURL } = stubDownload();
    const appendChild = vi.spyOn(document.body, "appendChild");
    render(<ReportSurface report={report} />);

    fireEvent.click(screen.getByRole("button", { name: "Export report" }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    // The spy is set before render(), so `render` itself appends the surface
    // container. Locate the actual anchor append within the call history.
    const anchorCall = appendChild.mock.calls.find(
      ([node]) => (node as HTMLElement).tagName === "A",
    );
    const anchor = anchorCall?.[0] as HTMLAnchorElement;
    expect(anchor).toBeDefined();
    expect(anchor.tagName).toBe("A");
    expect(anchor.download).toBe("a11yfix-report-example-com-2026-08-15.html");
    expect(anchor.href).toBe("blob:export-test");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:export-test");
  });

  it("EXPORT_SUCCESS: the button briefly shows the truncated filename, then resets", async () => {
    vi.useFakeTimers();
    try {
      stubDownload();
      render(<ReportSurface report={EMPTY_REPORT} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export report" }));
      });
      const successButton = screen.getByRole("button", {
        name: "Downloaded a11yfix-report-example-com-2026-08-15.html",
      });
      expect(successButton).not.toBeNull();
      // Long filenames truncate gracefully on narrow surfaces.
      expect(successButton.className).toContain("max-w-[16rem]");
      expect(successButton.className).toContain("truncate");

      vi.advanceTimersByTime(2000);
      await act(async () => {});
      expect(screen.queryByRole("button", { name: /Downloaded/ })).toBeNull();
      expect(screen.getByRole("button", { name: "Export report" })).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("EXPORT_FAILURE: a failed download shows an inline alert; Retry recovers to success", async () => {
    let failing = true;
    const createObjectURL = vi.fn(() => {
      if (failing) throw new Error("blob unavailable");
      return "blob:export-test";
    });
    URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
    Object.defineProperty(HTMLAnchorElement.prototype, "click", {
      configurable: true,
      writable: true,
      value: vi.fn(),
    });
    render(<ReportSurface report={EMPTY_REPORT} />);

    fireEvent.click(screen.getByRole("button", { name: "Export report" }));

    expect(screen.getByRole("alert")).not.toBeNull();
    expect(screen.getByText("Export failed — please try again")).not.toBeNull();
    const retry = screen.getByRole("button", { name: "Retry" });
    expect(retry).not.toBeNull();
    // The original Export button never dead-ends while in the error state.
    expect(screen.getByRole("button", { name: "Export report" })).not.toBeNull();

    failing = false;
    fireEvent.click(retry);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(
      screen.getByRole("button", {
        name: "Downloaded a11yfix-report-example-com-2026-08-15.html",
      }),
    ).not.toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(2);
  });

  it("EXPORT_ERROR_NOT_OVERWRITTEN: a failure right after a success keeps the error alert (stale success timer cleared)", async () => {
    vi.useFakeTimers();
    try {
      let failing = false;
      const createObjectURL = vi.fn(() => {
        if (failing) throw new Error("blob unavailable");
        return "blob:export-test";
      });
      URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
      URL.revokeObjectURL = vi.fn() as unknown as typeof URL.revokeObjectURL;
      Object.defineProperty(HTMLAnchorElement.prototype, "click", {
        configurable: true,
        writable: true,
        value: vi.fn(),
      });
      render(<ReportSurface report={EMPTY_REPORT} />);

      // Success arms the ~2 s reset timer.
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Export report" }));
      });
      expect(
        screen.getByRole("button", {
          name: "Downloaded a11yfix-report-example-com-2026-08-15.html",
        }),
      ).not.toBeNull();

      // Within the success window a second export fails.
      failing = true;
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Downloaded/ }));
      });
      expect(screen.getByRole("alert")).not.toBeNull();

      // The stale success timer must not clear the error alert early.
      vi.advanceTimersByTime(3000);
      await act(async () => {});
      expect(screen.getByRole("alert")).not.toBeNull();
      expect(screen.getByRole("button", { name: "Retry" })).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("health chip names exactly the present bands: moderate-only report", () => {
    const report = makeReport([makeViolation("moderate", "v3")]);
    render(<ReportSurface report={report} />);
    expect(screen.getByText("Moderate issues")).not.toBeNull();
    expect(screen.queryByText("Moderate and minor issues")).toBeNull();
  });

  it("health chip names exactly the present bands: minor-only report stays conforming", () => {
    const report = makeReport([makeViolation("minor", "v5")]);
    render(<ReportSurface report={report} />);
    const healthChip = screen.getByText("Minor issues");
    expect(healthChip.className).toContain("bg-conforming-container");
    expect(screen.queryByText("Moderate and minor issues")).toBeNull();
    expect(screen.queryByText(/all good/i)).toBeNull();
  });

  it("health chip names both bands when moderate and minor coexist", () => {
    const report = makeReport([
      makeViolation("moderate", "v3"),
      makeViolation("minor", "v5"),
    ]);
    render(<ReportSurface report={report} />);
    expect(screen.getByText("Moderate and minor issues")).not.toBeNull();
  });

  it("introduces no transitions anywhere (Reduce Motion)", () => {
    const { container } = render(<ReportSurface report={EMPTY_REPORT} />);
    expect(container.innerHTML.includes("transition")).toBe(false);
  });

  it("wraps and stacks on narrow viewports instead of hiding content", () => {
    const { container } = render(<ReportSurface report={EMPTY_REPORT} />);
    const header = container.querySelector("header");
    expect(header?.className).toContain("flex-wrap");
    expect(container.querySelector("h2")?.className).toContain("break-all");
    expect(container.querySelectorAll("[style*='display: none']")).toHaveLength(0);
    expect(container.querySelector("[aria-label='Client view']")).not.toBeNull();
  });
});