import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DiffViewer } from "@/components/diff-viewer";
import type { ArchitectPatch } from "@/lib/translate/architect";

afterEach(() => {
  cleanup();
  delete (navigator as { clipboard?: unknown }).clipboard;
  vi.useRealTimers();
});

function mockClipboard(writeText: (text: string) => Promise<void> | undefined) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

const PATCH: ArchitectPatch = {
  status: "proposed",
  diff: `--- a/src/components/Card.tsx
+++ b/src/components/Card.tsx
@@ -1 +1,4 @@
-  <img className="h-40 w-full object-cover" />
+  <img
+    className="h-40 w-full object-cover"
+    alt="Product image"
+  />
`,
  rationale:
    "Adds descriptive alt text to product images, addressing violation v-1 (WCAG 1.1.1).",
  wcag_rule: "WCAG 1.1.1",
};

describe("DiffViewer", () => {
  it("renders the proposed badge and a review-only surface with a copy action", () => {
    const { container } = render(<DiffViewer patch={PATCH} />);
    expect(screen.getByText("Proposed — not applied.")).not.toBeNull();
    expect(screen.getByText("Proposed changes")).not.toBeNull();
    expect(container.querySelector("[data-surface='dark']")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Copy diff" })).not.toBeNull();
  });

  it("never offers an apply, accept, or merge control (review-only invariant)", () => {
    const { container } = render(<DiffViewer patch={PATCH} />);
    const buttons = screen.queryAllByRole("button");
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toBe("Copy diff");
    expect(buttons[0].textContent).not.toMatch(/apply|accept|merge|confirm|save/i);
    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(container.querySelectorAll("[role='button']")).toHaveLength(0);
  });

  it("classifies each line with a data-line-type and a real gutter character", () => {
    const { container } = render(<DiffViewer patch={PATCH} />);
    const rows = Array.from(container.querySelectorAll("[data-line-type]"));
    expect(rows.map((row) => row.getAttribute("data-line-type"))).toEqual([
      "context", // --- a/...
      "context", // +++ b/...
      "context", // @@ hunk header
      "del",
      "add",
      "add",
      "add",
      "add",
    ]);
    expect(container.querySelector("[data-line-type='del']")?.textContent).toContain("-");
    expect(container.querySelector("[data-line-type='add']")?.textContent).toContain("+");
    expect(container.querySelector("[data-line-type='context']")?.textContent).toContain("·");
  });

  it.each([
    "@@ -1,5 +1,5 @@",
    "--- a/src/components/Card.tsx",
    "+++ b/src/components/Card.tsx",
    "  const x = 1;",
    "\\ No newline at end of file",
  ])("renders %s as context, not as an add/remove line", (diff) => {
    const { container } = render(<DiffViewer patch={{ ...PATCH, diff }} />);
    expect(container.querySelectorAll("[data-line-type='add']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-line-type='del']")).toHaveLength(0);
    expect(container.querySelectorAll("[data-line-type='context']").length).toBeGreaterThan(0);
  });

  it("strips the diff prefix from a space-prefixed context line", () => {
    const { container } = render(<DiffViewer patch={{ ...PATCH, diff: "  const x = 1;" }} />);
    const row = container.querySelector("[data-line-type='context']");
    expect(row).not.toBeNull();
    expect(row?.textContent).toContain("·");
    expect(row?.textContent).toContain(" const x = 1;");
  });

  it("writes the raw patch.diff to the clipboard and shows a quiet inline confirmation", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<DiffViewer patch={PATCH} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy diff" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(PATCH.diff);
    expect(screen.getByRole("status").textContent).toBe("Copied");
  });

  it("is keyboard-operable: a native button copies when activated", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);
    render(<DiffViewer patch={PATCH} />);
    const button = screen.getByRole("button", { name: "Copy diff" });
    // A native <button> is the browser contract that guarantees Enter/Space
    // activation; jsdom cannot synthesize that, so assert the element type and
    // that programmatic activation still reaches the clipboard.
    expect(button.tagName).toBe("BUTTON");
    fireEvent.click(button);
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
  });

  it("does not crash and shows no false confirmation when the clipboard rejects", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    mockClipboard(writeText);
    render(<DiffViewer patch={PATCH} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy diff" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("resets the Copied confirmation after ~1500ms and clears the timer on unmount", async () => {
    vi.useFakeTimers();
    try {
      const writeText = vi.fn().mockResolvedValue(undefined);
      mockClipboard(writeText);
      const { unmount } = render(<DiffViewer patch={PATCH} />);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy diff" }));
      });
      expect(screen.getByRole("status").textContent).toBe("Copied");

      vi.advanceTimersByTime(1500);
      await act(async () => {});
      expect(screen.queryByRole("status")).toBeNull();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copy diff" }));
      });
      expect(screen.getByRole("status").textContent).toBe("Copied");
      expect(() => unmount()).not.toThrow();
    } finally {
      vi.useRealTimers();
    }
  });

  it("degrades silently when navigator.clipboard is genuinely absent", () => {
    delete (navigator as { clipboard?: unknown }).clipboard;
    render(<DiffViewer patch={PATCH} />);
    expect(() => fireEvent.click(screen.getByRole("button", { name: "Copy diff" }))).not.toThrow();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("shows an empty-diff note but keeps the badge, title, and copy button", () => {
    const { container } = render(<DiffViewer patch={{ ...PATCH, diff: "" }} />);
    expect(screen.getByText("No diff to render.")).not.toBeNull();
    expect(screen.getByText("Proposed — not applied.")).not.toBeNull();
    expect(screen.getByText("Proposed changes")).not.toBeNull();
    expect(container.querySelectorAll("[data-line-type]")).toHaveLength(0);
    expect(screen.getByRole("button", { name: "Copy diff" })).not.toBeNull();
  });

  it("treats a whitespace-only diff as empty", () => {
    const { container } = render(<DiffViewer patch={{ ...PATCH, diff: "\n" }} />);
    expect(screen.getByText("No diff to render.")).not.toBeNull();
    expect(container.querySelectorAll("[data-line-type]")).toHaveLength(0);
  });

  it("wraps long lines without clipping", () => {
    const longLine = "x".repeat(160);
    const { container } = render(
      <DiffViewer patch={{ ...PATCH, diff: `--- a/f\n+++ b/f\n@@ -1 +1 @@\n+${longLine}\n` }} />,
    );
    expect(screen.getByText(longLine)).not.toBeNull();
    const content = container.querySelector("[data-line-type='add'] .whitespace-pre-wrap");
    expect(content).not.toBeNull();
    expect(content?.className).toContain("min-w-0");
  });

  it("hides line numbers from assistive tech", () => {
    const { container } = render(<DiffViewer patch={PATCH} />);
    const rows = container.querySelectorAll("[data-line-type]");
    expect(rows.length).toBeGreaterThan(0);
    expect(
      container.querySelectorAll("[data-line-type] span[aria-hidden='true']"),
    ).toHaveLength(rows.length);
  });
});