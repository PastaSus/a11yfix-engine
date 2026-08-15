import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ProgressStepper } from "@/components/progress-stepper";

afterEach(() => {
  cleanup();
});

describe("ProgressStepper", () => {
  it("renders the three named stages in order", () => {
    render(<ProgressStepper current="scanning" />);
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(3);
    expect(items.map((item) => item.textContent)).toEqual([
      expect.stringContaining("Scanning"),
      expect.stringContaining("Translating"),
      expect.stringContaining("Ready"),
    ]);
  });

  it("labels the list as scan progress", () => {
    render(<ProgressStepper current="scanning" />);
    expect(screen.getByRole("list", { name: "Scan progress" })).not.toBeNull();
  });

  it("marks the current step with aria-current=step", () => {
    const { rerender } = render(<ProgressStepper current="translating" />);
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");

    rerender(<ProgressStepper current="ready" />);
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Ready");
  });

  it("announces completed steps as completed and future steps as not", () => {
    render(<ProgressStepper current="translating" />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].textContent).toContain("completed"); // Scanning finished
    expect(items[1].textContent).not.toContain("completed"); // Translating is current
    expect(items[2].textContent).not.toContain("completed"); // Ready not started
  });
});