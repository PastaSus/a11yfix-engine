import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScanForm } from "@/components/scan-form";
import type { ScanResult } from "@/lib/scan";

const RESULT: ScanResult = {
  schemaVersion: "1.0.0",
  scanId: "01J123456789ABCDEFGHJKLMNP",
  url: "https://example.com",
  violations: [
    {
      id: "color-contrast",
      impact: "critical",
      description: "Elements must meet minimum color contrast ratio thresholds",
      helpUrl: "https://dequeuniversity.com/rules/axe/4.10/color-contrast",
      nodes: [{ nodeId: "a[href]", coordinates: null }],
    },
    {
      id: "aria-valid-attr",
      impact: "serious",
      description: "ARIA attributes must conform to valid values",
      helpUrl: null,
      nodes: [{ nodeId: "[aria-label]", coordinates: null }],
    },
  ],
  vitals: { lcp: 1200.4, inp: null, cls: 0.1 },
  timestamp: "2026-08-15T12:30:00.000Z",
};

const EMPTY_STATE_COPY = "No scans yet — paste a URL to run your first audit.";
const PAUSED_COPY = "Translation is waiting on a free-tier limit — retrying.";
const UNREACHABLE_HINT = "We couldn't reach that site — it may be down, or the network is slow.";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

function getForm(): HTMLFormElement {
  const input = screen.getByLabelText("Website URL");
  return input.closest("form") as HTMLFormElement;
}

function typeIn(input: HTMLElement, value: string) {
  fireEvent.change(input, { target: { value } });
}

function submitScanForm() {
  fireEvent.submit(getForm());
}

function flushMicrotasks() {
  return act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function jsonLike(data: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

describe("ScanForm", () => {
  it("renders the empty-state copy on first load", () => {
    render(<ScanForm />);
    expect(screen.queryByText(EMPTY_STATE_COPY)).not.toBeNull();
  });

  it("shows an inline error with aria-invalid for an invalid URL and never POSTs", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "example.com");
    submitScanForm();

    expect(screen.getByRole("alert").textContent).toMatch(/scheme/i);
    expect(screen.getByLabelText("Website URL").getAttribute("aria-invalid")).toBe("true");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("submits a valid URL, lands on Translating, then Ready with counts and vitals", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonLike(RESULT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();

    // Scan started; the pass-through must land on Translating before Ready.
    await flushMicrotasks();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");

    advance(600);
    await flushMicrotasks();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Ready");

    expect(screen.queryByText("2 violations")).not.toBeNull();
    expect(screen.queryByText("https://example.com")).not.toBeNull();
    expect(screen.queryByText("1200 ms")).not.toBeNull();
    expect(screen.queryByText("0.1")).not.toBeNull();
    expect(screen.queryByText("Scanned at")).not.toBeNull();
    const readyRole = screen.getByText("2 violations").closest("dl")?.getAttribute("role");
    expect(readyRole).toBe("status");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com" });
  });

  it("trims leading/trailing whitespace before POSTing", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonLike(RESULT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "   https://example.com   ");
    submitScanForm();

    await flushMicrotasks();
    advance(600);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com" });
  });

  it("accepts a loopback https URL and starts the pipeline", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonLike(RESULT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://127.0.0.1:8443");
    submitScanForm();

    await flushMicrotasks();
    advance(600);
    expect(screen.queryByRole("alert")).toBeNull();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://127.0.0.1:8443" });
  });

  it("renders a failed state with a human cause hint and Retry on 502", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonLike(
          { code: "unreachable", message: "The scanner service is unavailable.", stage: "harvest" },
          502,
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://unreachable.example");
    submitScanForm();

    await flushMicrotasks();
    expect(screen.queryByText(UNREACHABLE_HINT)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });

  it("renders a paused state with the exact rate-limit copy and Translating step on 503", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonLike({ code: "busy", message: "No scan slots available.", stage: "harvest" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://busy.example");
    submitScanForm();

    await flushMicrotasks();
    expect(screen.queryByText(PAUSED_COPY)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");
  });

  it("retries the current edited input after a failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonLike({ code: "unreachable", message: "down", stage: "harvest" }, 502))
      .mockResolvedValueOnce(jsonLike(RESULT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    const input = screen.getByLabelText("Website URL");
    typeIn(input, "https://old.example");
    submitScanForm();
    await flushMicrotasks();
    expect(screen.queryByText(UNREACHABLE_HINT)).not.toBeNull();

    typeIn(input, "https://edited.example");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flushMicrotasks();
    advance(600);
    await flushMicrotasks();

    expect(screen.queryByText("2 violations")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(retryInit.body as string)).toEqual({ url: "https://edited.example" });
  });

  it("paused state retries the last submitted URL when the input is emptied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonLike({ code: "busy", message: "no slots", stage: "harvest" }, 503))
      .mockResolvedValueOnce(jsonLike(RESULT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    const input = screen.getByLabelText("Website URL");
    typeIn(input, "https://example.com");
    submitScanForm();
    await flushMicrotasks();
    expect(screen.queryByText(PAUSED_COPY)).not.toBeNull();

    typeIn(input, "");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flushMicrotasks();
    advance(600);
    await flushMicrotasks();

    expect(screen.queryByText("2 violations")).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [, retryInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(JSON.parse(retryInit.body as string)).toEqual({ url: "https://example.com" });
  });

  it("ignores double submission while a scan is already in flight", async () => {
    let resolveScan: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveScan = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();
    submitScanForm();

    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveScan?.(jsonLike(RESULT, 200));
    });
    advance(600);
    await flushMicrotasks();
    expect(screen.queryByText("2 violations")).not.toBeNull();
  });
});