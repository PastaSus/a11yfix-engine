import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ReportSurface } from "@/components/report-surface";
import { severityTier } from "@/lib/severity";
import type { Violation } from "@/lib/scan";
import type { AuditReport } from "@/lib/translate/client";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
  vi.unstubAllGlobals();
});

function makeViolation(impact: Violation["impact"], id: string): Violation {
  return {
    id,
    impact,
    description: `Violation ${id}`,
    helpUrl: null,
    nodes: [],
  };
}

function makeReport(violations: Violation[]): AuditReport {
  return {
    schemaVersion: "1.0.0",
    scanId: "01J123456789ABCDEFGHJKLMNP",
    url: "https://example.com",
    violations,
    vitals: { lcp: 1200, inp: null, cls: 0.1 },
    timestamp: "2026-08-15T12:30:00.000Z",
    analyst_impacts: [],
    architect_patches: [],
  };
}

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

  it("renders the Client placeholder view by default and switches to Developer instantly", () => {
    render(<ReportSurface report={EMPTY_REPORT} />);
    expect(screen.getByLabelText("Client view")).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Developer" }));
    expect(screen.getByLabelText("Developer view")).not.toBeNull();
    expect(screen.queryByLabelText("Client view")).toBeNull();
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

  it("Export stays an inert placeholder: present, focusable, and a no-op click", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ReportSurface report={EMPTY_REPORT} />);
    const exportButton = screen.getByRole("button", { name: "Export report" });
    expect(exportButton.tagName).toBe("BUTTON");
    expect(exportButton.className).toContain("h-11");
    expect(exportButton.className).toContain("focus-visible:outline-2");
    expect(() => fireEvent.click(exportButton)).not.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
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