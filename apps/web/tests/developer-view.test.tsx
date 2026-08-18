import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { DeveloperView } from "@/components/developer-view";
import { makePatch, makeReport, makeViolation } from "@/tests/fixtures";
import type { ViolationNode } from "@/lib/scan";

const NATIVE_SCROLL_TO = Object.getOwnPropertyDescriptor(window, "scrollTo");
const NATIVE_SCROLL_INTO_VIEW = Object.getOwnPropertyDescriptor(
  Element.prototype,
  "scrollIntoView",
);

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  if (NATIVE_SCROLL_TO) {
    Object.defineProperty(window, "scrollTo", NATIVE_SCROLL_TO);
  } else {
    delete (window as { scrollTo?: unknown }).scrollTo;
  }
  if (NATIVE_SCROLL_INTO_VIEW) {
    Object.defineProperty(Element.prototype, "scrollIntoView", NATIVE_SCROLL_INTO_VIEW);
  } else {
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
});

function node(id: string): ViolationNode {
  return { nodeId: id, coordinates: null };
}

const HAPPY_VIOLATIONS = [
  makeViolation("critical", "nx-1", [node("n1"), node("n2")]),
  makeViolation("serious", "bx-2"),
  makeViolation("moderate", "cx-3", [node("n4")]),
  makeViolation("minor", "ax-4", [node("n1"), node("n2"), node("n3"), node("n4"), node("n5")]),
];

const HAPPY_REPORT = makeReport(HAPPY_VIOLATIONS, [], [makePatch()]);

function violationRows(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll("[data-violation-row]"));
}

function rowIds(container: HTMLElement): string[] {
  return violationRows(container).map((row) => row.getAttribute("data-violation-row") ?? "");
}

function stubScrollBehaviors() {
  const scrollTo = vi.fn();
  const scrollIntoView = vi.fn();
  Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: scrollTo });
  Object.defineProperty(Element.prototype, "scrollIntoView", {
    configurable: true,
    writable: true,
    value: scrollIntoView,
  });
  return { scrollTo, scrollIntoView };
}

describe("DeveloperView", () => {
  it("HAPPY_PATH: rows show rule ID (mono), severity chip, node count, and expandable detail", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);

    expect(rowIds(container)).toEqual(["nx-1", "bx-2", "cx-3", "ax-4"]);

    const first = violationRows(container)[0];
    const ruleChip = within(first).getByText("nx-1");
    expect(ruleChip.className).toContain("font-mono");
    expect(within(first).getByText("Critical").className).toContain("bg-critical-container");
    expect(within(first).getByText("2").className).toContain("tabular-nums");

    const moderate = violationRows(container)[2];
    expect(within(moderate).getByText("Moderate").className).toContain("bg-moderate-container");
    expect(moderate.className).toContain("focus-visible:outline-2");

    expect(screen.queryByText("Violation nx-1")).toBeNull();
    fireEvent.click(within(first).getByText("nx-1"));
    expect(screen.getByText("Violation nx-1")).not.toBeNull();
    const link = screen.getByRole("link", { name: "Learn more at axe" });
    expect(link.getAttribute("href")).toBe("https://dequeuniversity.com/rules/axe/4.11/button-name");
  });

  it("default sort is severity descending: critical first, then serious, moderate, minor", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    expect(rowIds(container)).toEqual(["nx-1", "bx-2", "cx-3", "ax-4"]);
    expect(container.querySelector("thead th[aria-sort='descending']")?.textContent).toContain("Severity");
  });

  it("SORT_BY_RULE: clicking the Rule header reorders alphabetically (stable, ascending)", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    expect(rowIds(container)).toEqual(["ax-4", "bx-2", "cx-3", "nx-1"]);
    expect(container.querySelector("thead th[aria-sort='ascending']")?.textContent).toContain("Rule");
  });

  it("SORT_BY_NODES: clicking the Nodes header reorders by affected-node count descending", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Nodes" }));
    expect(rowIds(container)).toEqual(["ax-4", "nx-1", "cx-3", "bx-2"]);
    expect(container.querySelector("thead th[aria-sort='descending']")?.textContent).toContain("Nodes");
  });

  it("SORT_BY_SEVERITY: a second severity click toggles to ascending", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Nodes" }));
    fireEvent.click(screen.getByRole("button", { name: "Severity" }));
    expect(rowIds(container)).toEqual(["nx-1", "bx-2", "cx-3", "ax-4"]);
    fireEvent.click(screen.getByRole("button", { name: "Severity" }));
    expect(rowIds(container)).toEqual(["ax-4", "cx-3", "bx-2", "nx-1"]);
  });

  it("stable sort: equal rows keep their report order", () => {
    const report = makeReport([
      makeViolation("critical", "v-1"),
      makeViolation("critical", "v-2"),
    ]);
    const { container } = render(<DeveloperView report={report} pendingViewFix={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Nodes" }));
    expect(rowIds(container)).toEqual(["v-1", "v-2"]);
  });

  it("INLINE_EXPAND: clicking a row expands instantly and the button toggles it closed", () => {
    const report = makeReport([makeViolation("critical", "v-1")]);
    render(<DeveloperView report={report} pendingViewFix={null} />);

    expect(screen.queryByText("Violation v-1")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Show details for v-1" }));
    expect(screen.getByText("Violation v-1")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Learn more at axe" })).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide details for v-1" }));
    expect(screen.queryByText("Violation v-1")).toBeNull();
  });

  it("no helpUrl: the expanded detail renders the description without a link", () => {
    const report = makeReport([{ ...makeViolation("critical", "v-1"), helpUrl: null }]);
    render(<DeveloperView report={report} pendingViewFix={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Show details for v-1" }));
    expect(screen.getByText("Violation v-1")).not.toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("KEYBOARD_EXPAND: Enter and Space on a focused violation row expand and collapse it", () => {
    const report = makeReport([makeViolation("critical", "v-1")]);
    const { container } = render(<DeveloperView report={report} pendingViewFix={null} />);
    const row = container.querySelector("[data-violation-row='v-1']");
    expect(row).not.toBeNull();

    fireEvent.keyDown(row as Element, { key: "Enter" });
    expect(screen.getByText("Violation v-1")).not.toBeNull();

    fireEvent.keyDown(row as Element, { key: " " });
    expect(screen.queryByText("Violation v-1")).toBeNull();
  });

  it("the violation table carries an accessible name", () => {
    render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    expect(screen.getByRole("table", { name: "Violations" })).not.toBeNull();
  });

  it("vitals render as labelled metric cards with unit suffixes and tabular figures", () => {
    render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);

    const lcp = screen.getByRole("group", { name: "LCP: 1200 ms" });
    const lcpFigure = within(lcp).getByText("1200");
    expect(lcpFigure.className).toContain("text-3xl");
    expect(lcpFigure.className).toContain("font-bold");
    expect(lcpFigure.className).toContain("tabular-nums");
    expect(within(lcp).getByText("ms")).not.toBeNull();

    const inp = screen.getByRole("group", { name: "INP: not measured" });
    expect(within(inp).getByText("\u2014")).not.toBeNull();

    const cls = screen.getByRole("group", { name: "CLS: 0.1" });
    expect(within(cls).getByText("0.1")).not.toBeNull();
  });

  it("vitals values render at dashboard precision (ms rounded, CLS to two decimals)", () => {
    const report = {
      ...makeReport([makeViolation("critical", "v-1")]),
      vitals: { lcp: 1200.4, inp: 47.6, cls: 0.0523415 },
    };
    render(<DeveloperView report={report} pendingViewFix={null} />);

    expect(screen.getByRole("group", { name: "LCP: 1200 ms" })).not.toBeNull();
    expect(screen.getByRole("group", { name: "INP: 48 ms" })).not.toBeNull();
    expect(screen.getByRole("group", { name: "CLS: 0.05" })).not.toBeNull();
    expect(screen.getByText("0.05")).not.toBeNull();
  });

  it("NULL_VITALS: null metrics show '—' with a 'not measured' screen-reader label", () => {
    const report = {
      ...makeReport([makeViolation("critical", "v-1")]),
      vitals: { lcp: null, inp: null, cls: null },
    };
    render(<DeveloperView report={report} pendingViewFix={null} />);
    for (const metric of ["LCP", "INP", "CLS"]) {
      const card = screen.getByRole("group", { name: `${metric}: not measured` });
      expect(within(card).getByText("\u2014")).not.toBeNull();
    }
  });

  it("patches render via DiffViewer with wcag_rule chip and rationale, in array order", () => {
    const report = makeReport(
      [makeViolation("critical", "v-1")],
      [],
      [
        makePatch(undefined, { wcag_rule: "WCAG 1.1.1", rationale: "First patch rationale." }),
        makePatch(undefined, { wcag_rule: "WCAG 4.1.2", rationale: "Second patch rationale." }),
      ],
    );
    render(<DeveloperView report={report} pendingViewFix={null} />);

    expect(screen.getAllByRole("button", { name: "Copy diff" })).toHaveLength(2);
    const chips = screen.getAllByText(/^WCAG /);
    expect(chips.map((chip) => chip.textContent)).toEqual(["WCAG 1.1.1", "WCAG 4.1.2"]);
    expect(screen.getByText("First patch rationale.")).not.toBeNull();
    expect(screen.getByText("Second patch rationale.")).not.toBeNull();
    expect(screen.getAllByRole("heading", { name: "Proposed changes" })).toHaveLength(2);
  });

  it("NO_VIOLATIONS: empty table note, vitals still render, empty patches note", () => {
    render(<DeveloperView report={makeReport([], [], [])} pendingViewFix={null} />);
    expect(screen.getByText("No violations detected")).not.toBeNull();
    expect(screen.getByRole("group", { name: "LCP: 1200 ms" })).not.toBeNull();
    expect(screen.getByText("No generated patches")).not.toBeNull();
  });

  it("NO_PATCHES: violations render normally with a restrained patches note", () => {
    const { container } = render(
      <DeveloperView report={makeReport([makeViolation("critical", "v-1")], [], [])} pendingViewFix={null} />,
    );
    expect(violationRows(container)).toHaveLength(1);
    expect(screen.getByText("No generated patches")).not.toBeNull();
    expect(screen.queryByText(/all good/i)).toBeNull();
  });

  it("VIEW_FIX_FOCUS: a pending view-fix id scrolls to and focuses the matching row only", () => {
    const { scrollTo, scrollIntoView } = stubScrollBehaviors();
    const report = makeReport([
      makeViolation("critical", "ny-1"),
      makeViolation("moderate", "ax-2"),
    ]);
    const { container } = render(<DeveloperView report={report} pendingViewFix="ax-2" />);

    const target = container.querySelector("[data-violation-row='ax-2']");
    expect(target).not.toBeNull();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "instant", block: "nearest" });
    expect(document.activeElement).toBe(target);
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("NO_AUTOSCROLL: rendering, sorting, and expanding perform zero scroll behavior", () => {
    const { scrollTo, scrollIntoView } = stubScrollBehaviors();
    const { container } = render(
      <DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Rule" }));
    fireEvent.click(screen.getByRole("button", { name: "Show details for nx-1" }));
    expect(violationRows(container)).toHaveLength(4);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("NO_RESCAN: rendering, sorting, expanding, and toggling perform zero fetch calls", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    fireEvent.click(screen.getByRole("button", { name: "Severity" }));
    fireEvent.click(screen.getByRole("button", { name: "Show details for bx-2" }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("interactive elements are focusable native buttons, labelled, 44px, with a visible focus ring", () => {
    render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
    for (const button of buttons) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.tabIndex).toBe(0);
      expect(button.className).toContain("h-11");
      expect(button.className).toContain("focus-visible:outline-2");
    }
    const sortButton = screen.getByRole("button", { name: "Severity" });
    expect(sortButton.className).toContain("focus-visible:outline-primary");
  });

  it("severity is never conveyed by color alone: every chip pairs a container tint with text", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    const chips = Array.from(
      container.querySelectorAll("td span[class*='container']"),
    ).filter((chip) => chip.textContent?.trim().match(/Critical|Moderate|Minor/));
    for (const chip of chips) {
      expect((chip as HTMLElement).className).toMatch(/bg-(critical|moderate|minor)-container/);
      expect(chip.textContent?.trim()).not.toBe("");
    }
  });

  it("introduces no transitions anywhere (Reduce Motion)", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    expect(container.innerHTML.includes("transition")).toBe(false);
  });

  it("NARROW_VIEWPORT: table scrolls horizontally, panels stack, nothing hidden", () => {
    const { container } = render(<DeveloperView report={HAPPY_REPORT} pendingViewFix={null} />);
    expect(container.querySelector(".overflow-x-auto")).not.toBeNull();
    expect(container.querySelector("table")).not.toBeNull();
    expect(container.querySelectorAll("[style*='display: none']")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Core Web Vitals" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Violations" })).not.toBeNull();
    expect(screen.getByRole("heading", { name: "Proposed fixes" })).not.toBeNull();
  });
});