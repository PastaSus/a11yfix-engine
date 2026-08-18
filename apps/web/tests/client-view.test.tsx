import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { ClientView } from "@/components/client-view";
import { countPhrase } from "@/lib/severity";
import { makeImpact, makeReport, makeViolation } from "@/tests/fixtures";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const HAPPY_IMPACTS = [
  makeImpact("v-c1", {
    business_problem: "Checkout forms lose entered data when a field fails validation.",
    affected_segment: "Customers on the product and checkout pages, roughly a quarter of mobile sessions.",
    wcag_consequence:
      "Fails WCAG 3.3.3 Error Suggestion; screen reader users may resubmit or abandon the purchase.",
    conversion_impact_estimate:
      "This plausibly blocks a meaningful share of checkout completions each month.",
  }),
  makeImpact("v-c2", {
    business_problem: "Keyboard users cannot reach the cart summary without tabbing through every link.",
  }),
  makeImpact("v-m1", {
    business_problem: "Low-contrast secondary text is hard to read in bright environments.",
  }),
];

const HAPPY_VIOLATIONS = [
  makeViolation("critical", "v-c1"),
  makeViolation("serious", "v-c2"),
  makeViolation("moderate", "v-m1"),
  makeViolation("minor", "v-mi1"),
];

const HAPPY_REPORT = makeReport(HAPPY_VIOLATIONS, HAPPY_IMPACTS);

const VIEW_FIX_BUTTONS = { name: /^View fix:/ };

function metricBlock(): HTMLElement {
  return screen.getByRole("group", { name: "Executive summary severity counts" });
}

function metricTile(phrase: string): HTMLElement {
  return within(metricBlock()).getByRole("group", { name: phrase });
}

describe("countPhrase", () => {
  it("pluralizes per tier with the singular for exactly one", () => {
    expect(countPhrase(1, "critical")).toBe("1 critical issue");
    expect(countPhrase(2, "critical")).toBe("2 critical issues");
    expect(countPhrase(3, "moderate")).toBe("3 moderate issues");
    expect(countPhrase(1, "minor")).toBe("1 minor issue");
    expect(countPhrase(0, "minor")).toBe("0 minor issues");
  });
});

describe("ClientView", () => {
  it("HAPPY_PATH: metric block with business-phrase figures and the priority list in array order", () => {
    const onViewFix = vi.fn();
    render(<ClientView report={HAPPY_REPORT} onViewFix={onViewFix} />);

    const block = metricBlock();
    expect(block).not.toBeNull();

    const criticalTile = metricTile("2 critical issues");
    expect(within(criticalTile).getByText("2")).not.toBeNull();
    expect(within(criticalTile).getByText("Critical")).not.toBeNull();
    expect(criticalTile.className).toContain("bg-critical-container");
    const moderateTile = metricTile("1 moderate issue");
    expect(within(moderateTile).getByText("1")).not.toBeNull();
    expect(within(moderateTile).getByText("Moderate")).not.toBeNull();
    expect(moderateTile.className).toContain("bg-moderate-container");
    const minorTile = metricTile("1 minor issue");
    expect(within(minorTile).getByText("Minor")).not.toBeNull();
    expect(minorTile.className).toContain("bg-minor-container");

    const list = screen.getByRole("list");
    expect(list.tagName).toBe("OL");
    const items = screen.getAllByRole("listitem");
    expect(items.map((item) => within(item).getByRole("heading", { level: 4 }).textContent)).toEqual(
      HAPPY_IMPACTS.map((impact) => impact.business_problem),
    );
    for (const impact of HAPPY_IMPACTS) {
      expect(screen.getByText(impact.affected_segment)).not.toBeNull();
      expect(screen.getByText(impact.wcag_consequence)).not.toBeNull();
      expect(screen.getByText(impact.conversion_impact_estimate)).not.toBeNull();
    }
    expect(screen.getAllByText("Affected users")).toHaveLength(HAPPY_IMPACTS.length);
    expect(screen.getAllByText("WCAG consequence")).toHaveLength(HAPPY_IMPACTS.length);
    expect(screen.getAllByText("Business impact")).toHaveLength(HAPPY_IMPACTS.length);
  });

  it("ALL_PASS: zero figures, restrained no-critical register, no priority list, never 'All good!'", () => {
    const report = makeReport([], []);
    render(<ClientView report={report} onViewFix={vi.fn()} />);

    expect(metricTile("0 critical issues")).not.toBeNull();
    expect(metricTile("0 moderate issues")).not.toBeNull();
    expect(metricTile("0 minor issues")).not.toBeNull();
    expect(
      screen.getByText("No critical violations detected. Check the Developer view for the full report."),
    ).not.toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/all good/i)).toBeNull();
  });

  it("MODERATE_MINOR_ONLY: tier counts render with the same restrained empty state, no fabricated impacts", () => {
    const report = makeReport(
      [makeViolation("moderate", "v-m1"), makeViolation("minor", "v-mi1")],
      [],
    );
    render(<ClientView report={report} onViewFix={vi.fn()} />);

    expect(metricTile("0 critical issues")).not.toBeNull();
    expect(metricTile("1 moderate issue")).not.toBeNull();
    expect(metricTile("1 minor issue")).not.toBeNull();
    expect(
      screen.getByText("No critical violations detected. Check the Developer view for the full report."),
    ).not.toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
    expect(screen.queryByText(/all good/i)).toBeNull();
  });

  it("CRITICAL_UNTANSLATED: figures show the critical count but no false-clean register and no priority list", () => {
    const report = makeReport(
      [makeViolation("critical", "v-c1"), makeViolation("serious", "v-c2")],
      [],
    );
    render(<ClientView report={report} onViewFix={vi.fn()} />);

    const criticalTile = metricTile("2 critical issues");
    expect(within(criticalTile).getByText("2")).not.toBeNull();
    expect(
      screen.queryByText("No critical violations detected. Check the Developer view for the full report."),
    ).toBeNull();
    expect(screen.getByText("Impact analysis unavailable. Check the Developer view for the full report.")).not.toBeNull();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("VIEW_FIX_TOGGLE: each 'view fix' is focusable, 44px, keeps 'View fix' text, and carries its violation_id", () => {
    const onViewFix = vi.fn();
    render(<ClientView report={HAPPY_REPORT} onViewFix={onViewFix} />);

    const buttons = screen.getAllByRole("button", VIEW_FIX_BUTTONS);
    expect(buttons).toHaveLength(HAPPY_IMPACTS.length);
    for (const [index, button] of buttons.entries()) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.tabIndex).toBe(0);
      expect(button.className).toContain("h-11");
      expect(button.className).toContain("focus-visible:outline-2");
      expect(button.textContent).toBe("View fix");
      expect(button.getAttribute("aria-label")).toBe(
        `View fix: ${HAPPY_IMPACTS[index].business_problem}`,
      );
    }
    fireEvent.click(buttons[0]);
    expect(onViewFix).toHaveBeenCalledWith(HAPPY_IMPACTS[0].violation_id);
  });

  it("BUSINESS_REGISTER: hedged copy verbatim, never rule IDs, helpUrl, or selectors", () => {
    const { container } = render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);

    expect(screen.getByText(/plausibly/i)).not.toBeNull();
    expect(screen.getByText("Checkout forms lose entered data when a field fails validation.")).not.toBeNull();
    expect(screen.getByText("Keyboard users cannot reach the cart summary without tabbing through every link.")).not.toBeNull();
    expect(container.innerHTML).not.toContain("v-c1");
    expect(container.innerHTML).not.toContain("dequeuniversity");
    expect(container.innerHTML).not.toContain("button-name");
    expect(container.innerHTML).not.toContain("helpUrl");
  });

  it("NO_RESCAN: rendering and a view-fix press perform zero fetch calls", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", VIEW_FIX_BUTTONS)[0]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("NO_AUTOSCROLL: a view-fix press triggers no scrollTo or scrollIntoView (banned interaction)", () => {
    const scrollTo = vi.fn();
    const scrollIntoView = vi.fn();
    Object.defineProperty(window, "scrollTo", { configurable: true, writable: true, value: scrollTo });
    Object.defineProperty(Element.prototype, "scrollIntoView", {
      configurable: true,
      writable: true,
      value: scrollIntoView,
    });
    render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);
    fireEvent.click(screen.getAllByRole("button", VIEW_FIX_BUTTONS)[0]);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("metric block label is distinct from the header group label", () => {
    render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);
    expect(metricBlock().getAttribute("aria-label")).toBe("Executive summary severity counts");
  });

  it("P-4: metric figures are pinned large, bold, and tabular", () => {
    render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);
    const figure = within(metricTile("2 critical issues")).getByText("2");
    expect(figure.className).toContain("text-4xl");
    expect(figure.className).toContain("font-bold");
    expect(figure.className).toContain("tabular-nums");
  });

  it("P-3: metric tiles use the in-scale rounded-lg shape, not an off-scale radius", () => {
    render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);
    for (const tier of ["2 critical issues", "1 moderate issue", "1 minor issue"]) {
      expect(metricTile(tier).className).toContain("rounded-lg");
    }
    expect(metricBlock().innerHTML).not.toContain("rounded-2xl");
  });

  it("NARROW_VIEWPORT: cards stack, nothing is hidden, and no transitions are introduced", () => {
    const { container } = render(<ClientView report={HAPPY_REPORT} onViewFix={vi.fn()} />);
    const section = container.querySelector("section");
    expect(section?.className).toContain("grid");
    expect(section?.className).toContain("md:grid-cols-12");
    expect(container.querySelectorAll("[style*='display: none']")).toHaveLength(0);
    expect(container.innerHTML.includes("transition")).toBe(false);
  });
});