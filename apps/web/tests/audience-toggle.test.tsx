import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudienceToggle } from "@/components/audience-toggle";

afterEach(() => {
  cleanup();
  window.sessionStorage.clear();
});

function buttons() {
  return {
    client: screen.getByRole("button", { name: "Client" }),
    developer: screen.getByRole("button", { name: "Developer" }),
  };
}

describe("AudienceToggle", () => {
  it("renders a labelled group with Client active by default", () => {
    render(<AudienceToggle value="client" onChange={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Audience" })).not.toBeNull();
    expect(buttons().client.getAttribute("aria-pressed")).toBe("true");
    expect(buttons().developer.getAttribute("aria-pressed")).toBe("false");
  });

  it("flips the active segment and persists the choice when Developer is selected", () => {
    const onChange = vi.fn();
    const { rerender } = render(<AudienceToggle value="client" onChange={onChange} />);
    fireEvent.click(buttons().developer);
    expect(onChange).toHaveBeenCalledWith("developer");
    expect(window.sessionStorage.getItem("darkhouse:audience")).toBe("developer");
    rerender(<AudienceToggle value="developer" onChange={onChange} />);
    expect(buttons().developer.getAttribute("aria-pressed")).toBe("true");
    expect(buttons().client.getAttribute("aria-pressed")).toBe("false");
  });

  it("restores a stored Developer selection after mount", () => {
    window.sessionStorage.setItem("darkhouse:audience", "developer");
    const onChange = vi.fn();
    const { rerender } = render(<AudienceToggle value="client" onChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith("developer");
    rerender(<AudienceToggle value="developer" onChange={onChange} />);
    expect(buttons().developer.getAttribute("aria-pressed")).toBe("true");
  });

  it("defaults to Client when the stored value is missing or empty", () => {
    const onChange = vi.fn();
    render(<AudienceToggle value="client" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    expect(buttons().client.getAttribute("aria-pressed")).toBe("true");
  });

  it("ignores an unknown stored value and stays on Client", () => {
    window.sessionStorage.setItem("darkhouse:audience", "admin");
    const onChange = vi.fn();
    render(<AudienceToggle value="client" onChange={onChange} />);
    expect(onChange).not.toHaveBeenCalled();
    expect(buttons().client.getAttribute("aria-pressed")).toBe("true");
  });

  it("is keyboard-operable: both segments are native focusable buttons", () => {
    render(<AudienceToggle value="client" onChange={vi.fn()} />);
    for (const button of [buttons().client, buttons().developer]) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.tabIndex).toBe(0);
    }
  });

  it("keeps a visible focus ring and a 44px touch target on every segment", () => {
    render(<AudienceToggle value="client" onChange={vi.fn()} />);
    for (const button of [buttons().client, buttons().developer]) {
      expect(button.className).toContain("focus-visible:outline-2");
      expect(button.className).toContain("h-11");
    }
  });

  it("introduces no transitions anywhere (Reduce Motion)", () => {
    const { container } = render(<AudienceToggle value="client" onChange={vi.fn()} />);
    expect(container.innerHTML.includes("transition")).toBe(false);
  });
});