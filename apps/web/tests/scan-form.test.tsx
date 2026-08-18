import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ScanForm } from "@/components/scan-form";
import type { ScanResult } from "@/lib/scan";
import { makeImpact, makePatch, makeReport } from "@/tests/fixtures";
import type { AuditReport } from "@/lib/translate/client";

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

const REPORT: AuditReport = makeReport(
  RESULT.violations,
  [makeImpact("color-contrast"), makeImpact("aria-valid-attr")],
  [makePatch(), makePatch()],
);

const EMPTY_STATE_COPY = "No scans yet — paste a URL to run your first audit.";
const PAUSED_COPY = "Translation is waiting on a free-tier limit — retrying.";
const UNREACHABLE_HINT = "We couldn't reach that site — it may be down, or the network is slow.";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

async function flush(rounds = 5) {
  await act(async () => {
    for (let i = 0; i < rounds; i += 1) {
      await Promise.resolve();
    }
  });
}

function jsonLike(data: unknown, status: number) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
  } as unknown as Response;
}

function pipelineMocks(scan: ScanResult = RESULT, report: AuditReport = REPORT) {
  const fetchMock = vi.fn((input: RequestInfo | URL) => {
    const target = String(input);
    if (target.endsWith("/api/translate")) {
      return Promise.resolve(jsonLike(report, 200));
    }
    return Promise.resolve(jsonLike(scan, 200));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
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
    expect(screen.getByLabelText("Website URL").getAttribute("aria-required")).toBe("true");
    expect((screen.getByLabelText("Website URL") as HTMLInputElement).required).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("scans, translates, and lands on Ready rendering the report surface", async () => {
    const fetchMock = pipelineMocks();

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();

    // Scan resolved; the real translator runs while the stepper sits on Translating.
    await flush();
    await flush();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Ready");

    expect(screen.getByRole("heading", { level: 2, name: "https://example.com" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Export report" })).not.toBeNull();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [scanUrl, scanInit] = fetchMock.mock.calls[0] as unknown as unknown as [string, RequestInit];
    expect(scanUrl).toContain("/api/scan");
    expect(scanInit.method).toBe("POST");
    expect(JSON.parse(scanInit.body as string)).toEqual({ url: "https://example.com" });

    const [translateUrl, translateInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(translateUrl).toContain("/api/translate");
    expect(JSON.parse(translateInit.body as string).scan.scanId).toBe(RESULT.scanId);
  });

  it("holds the Translating step while the translator is in flight", async () => {
    let resolveScan: ((value: unknown) => void) | undefined;
    let resolveTranslate: ((value: unknown) => void) | undefined;
    const fetchMock = vi.fn((input: RequestInfo | URL) => {
      if (String(input).endsWith("/api/translate")) {
        return new Promise((resolve) => {
          resolveTranslate = resolve;
        });
      }
      return new Promise((resolve) => {
        resolveScan = resolve;
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();

    await act(async () => {
      resolveScan?.(jsonLike(RESULT, 200));
    });
    await flush();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");

    await act(async () => {
      resolveTranslate?.(jsonLike(REPORT, 200));
    });
    await flush();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Ready");
    expect(screen.getByRole("button", { name: "Export report" })).not.toBeNull();
  });

  it("trims leading/trailing whitespace before POSTing", async () => {
    const fetchMock = pipelineMocks();

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "   https://example.com   ");
    submitScanForm();
    await flush();
    await flush();

    const [, init] = fetchMock.mock.calls[0] as unknown as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://example.com" });
  });

  it("accepts a loopback https URL and starts the pipeline", async () => {
    const fetchMock = pipelineMocks();

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://127.0.0.1:8443");
    submitScanForm();
    await flush();
    await flush();

    expect(screen.queryByRole("alert")).toBeNull();
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ url: "https://127.0.0.1:8443" });
  });

  it("renders a failed state with the envelope's message and Retry on a 502 scan", async () => {
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
    await flush();

    expect(screen.queryByText("The scanner service is unavailable.")).not.toBeNull();
    expect(screen.queryByText(UNREACHABLE_HINT)).toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("The scanner service is unavailable.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to mapped copy when the scan envelope message is empty", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonLike({ code: "unreachable", message: "", stage: "harvest" }, 502),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://unreachable.example");
    submitScanForm();
    await flush();

    expect(screen.queryByText(UNREACHABLE_HINT)).not.toBeNull();
  });

  it("renders a paused state with the exact rate-limit copy and Translating step on a busy scan", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonLike({ code: "busy", message: "No scan slots available.", stage: "harvest" }, 503));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://busy.example");
    submitScanForm();
    await flush();

    expect(screen.queryByText(PAUSED_COPY)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");
  });

  it("shows the paused state when translation is rate-limited (503)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonLike(RESULT, 200))
      .mockResolvedValueOnce(
        jsonLike({ code: "rate_limited", message: "Rate limited.", stage: "translate" }, 503),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();
    await flush();
    await flush();

    expect(screen.queryByText(PAUSED_COPY)).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.getByRole("listitem", { current: "step" }).textContent).toContain("Translating");
  });

  it("shows a failed state with the translate error message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonLike(RESULT, 200))
      .mockResolvedValueOnce(
        jsonLike({ code: "translate_error", message: "The AI provider could not be reached.", stage: "translate" }, 502),
      );
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();
    await flush();
    await flush();

    expect(screen.queryByText("The AI provider could not be reached.")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Retry" })).not.toBeNull();
    expect(screen.queryByRole("heading", { level: 2, name: "https://example.com" })).toBeNull();
  });

  it("retries the current edited input after a scan failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonLike({ code: "unreachable", message: "We couldn't reach the site — the server is down.", stage: "harvest" }, 502),
      )
      .mockResolvedValueOnce(jsonLike(RESULT, 200))
      .mockResolvedValueOnce(jsonLike(REPORT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    const input = screen.getByLabelText("Website URL");
    typeIn(input, "https://old.example");
    submitScanForm();
    await flush();
    expect(screen.queryByText("We couldn't reach the site — the server is down.")).not.toBeNull();

    typeIn(input, "https://edited.example");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();
    await flush();

    expect(screen.getByRole("heading", { level: 2, name: "https://example.com" })).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retryInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(retryInit.body as string)).toEqual({ url: "https://edited.example" });
  });

  it("paused state retries the last submitted URL when the input is emptied", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonLike({ code: "busy", message: "no slots", stage: "harvest" }, 503))
      .mockResolvedValueOnce(jsonLike(RESULT, 200))
      .mockResolvedValueOnce(jsonLike(REPORT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    const input = screen.getByLabelText("Website URL");
    typeIn(input, "https://example.com");
    submitScanForm();
    await flush();
    expect(screen.queryByText(PAUSED_COPY)).not.toBeNull();

    typeIn(input, "");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();
    await flush();

    expect(screen.getByRole("heading", { level: 2, name: "https://example.com" })).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [, retryInit] = fetchMock.mock.calls[1] as unknown as [string, RequestInit];
    expect(JSON.parse(retryInit.body as string)).toEqual({ url: "https://example.com" });
  });

  it("a translation failure retries the cached scan without re-scanning", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonLike(RESULT, 200))
      .mockResolvedValueOnce(
        jsonLike({ code: "translate_error", message: "AI down.", stage: "translate" }, 502),
      )
      .mockResolvedValueOnce(jsonLike(REPORT, 200));
    vi.stubGlobal("fetch", fetchMock);

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();
    await flush();
    await flush();
    expect(screen.queryByText("AI down.")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();
    await flush();

    expect(screen.getByRole("heading", { level: 2, name: "https://example.com" })).not.toBeNull();
    const scanCalls = fetchMock.mock.calls.filter(([input]) => String(input).endsWith("/api/scan"));
    expect(scanCalls).toHaveLength(1);
    const translateCalls = fetchMock.mock.calls.filter(([input]) =>
      String(input).endsWith("/api/translate"),
    );
    expect(translateCalls).toHaveLength(2);
  });

  it("ignores double submission while a scan is already in flight", async () => {
    const fetchMock = pipelineMocks();

    render(<ScanForm />);
    typeIn(screen.getByLabelText("Website URL"), "https://example.com");
    submitScanForm();
    submitScanForm();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await flush();
    await flush();
    expect(screen.getByRole("button", { name: "Export report" })).not.toBeNull();
  });
});