"use client";

import { Fragment, useRef, useState } from "react";
import { ProgressStepper } from "@/components/progress-stepper";
import type { StageName } from "@/components/progress-stepper";
import { ReportSurface } from "@/components/report-surface";
import { submitScan } from "@/lib/scan";
import type { ScanResult } from "@/lib/scan";
import { submitTranslate } from "@/lib/submit-translate";
import { validateScanUrl } from "@/lib/validate-scan-url";
import type { AuditReport } from "@/lib/translate/client";

const EMPTY_STATE_COPY = "No scans yet — paste a URL to run your first audit.";
const PAUSED_COPY = "Translation is waiting on a free-tier limit — retrying.";
const GENERIC_FAILURE_HINT = "Something went wrong while scanning — try again in a moment.";

const STAGE_ANNOUNCEMENT: Record<StageName, string> = {
  scanning: "Scanning your site.",
  translating: "Translating results.",
  ready: "Scan ready.",
};

type ScanState =
  | { stage: "idle" }
  | { stage: "scanning" }
  | { stage: "translating" }
  | { stage: "ready"; report: AuditReport }
  | { stage: "failed"; hint: string }
  | { stage: "paused" };

const FAILURE_HINTS: Record<string, string> = {
  unreachable: "We couldn't reach that site — it may be down, or the network is slow.",
  timeout: "The scan timed out — the site may be too slow to respond.",
  invalid_url: "That address looks invalid — check it and try again.",
  insecure_url: "That address isn't a secure https:// URL.",
  scan_error: GENERIC_FAILURE_HINT,
  translate_error: "The AI translation layer failed — try again in a moment.",
};

function failureHint(code: string): string {
  return FAILURE_HINTS[code] ?? GENERIC_FAILURE_HINT;
}

const INPUT_CLASSES =
  "h-11 flex-1 rounded-md border border-outline bg-surface px-3 text-on-surface " +
  "placeholder:text-on-surface-variant focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-primary";

const BUTTON_CLASSES =
  "h-11 rounded-md bg-primary px-5 text-sm font-semibold text-on-primary " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary " +
  "disabled:opacity-50";

const RETRY_CLASSES =
  "mt-3 inline-flex h-11 items-center justify-center rounded-md border border-outline " +
  "px-5 text-sm font-semibold text-on-surface focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-primary";

export function ScanForm() {
  const [url, setUrl] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submittedUrl, setSubmittedUrl] = useState<string | null>(null);
  const [state, setState] = useState<ScanState>({ stage: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);
  const inflight = useRef(false);
  const lastScan = useRef<{ url: string; result: ScanResult } | null>(null);

  async function runTranslate(scan: ScanResult) {
    setState({ stage: "translating" });
    const translation = await submitTranslate(scan);

    if (translation.ok) {
      setState({ stage: "ready", report: translation.data });
      return;
    }
    if (translation.status === 503 || translation.code === "rate_limited") {
      setState({ stage: "paused" });
      return;
    }
    const hint =
      translation.message.trim() !== "" ? translation.message : failureHint(translation.code);
    setState({ stage: "failed", hint });
  }

  async function runScan(target: string) {
    if (inflight.current) return;
    inflight.current = true;
    try {
      setState({ stage: "scanning" });
      const result = await submitScan(target);
      if (result.ok) {
        lastScan.current = { url: target, result: result.data };
        await runTranslate(result.data);
        return;
      }
      if (result.status === 503) {
        setState({ stage: "paused" });
        return;
      }
      const hint = result.message.trim() !== "" ? result.message : failureHint(result.code);
      setState({ stage: "failed", hint });
    } finally {
      inflight.current = false;
    }
  }

  async function retryTranslate() {
    const cached = lastScan.current;
    if (inflight.current || !cached) return;
    inflight.current = true;
    try {
      await runTranslate(cached.result);
    } finally {
      inflight.current = false;
    }
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inflight.current) return;
    const trimmed = url.trim();
    const error = validateScanUrl(trimmed);
    if (error) {
      setValidationError(error);
      inputRef.current?.focus();
      return;
    }
    setValidationError(null);
    setSubmittedUrl(trimmed);
    void runScan(trimmed);
  }

  function handleRetry() {
    if (inflight.current) return;
    const current = url.trim();
    if (current === "") {
      if (submittedUrl) void runScan(submittedUrl);
      return;
    }
    const error = validateScanUrl(current);
    if (error) {
      setValidationError(error);
      inputRef.current?.focus();
      return;
    }
    setValidationError(null);
    const cached = lastScan.current;
    if (cached && cached.url === current) {
      void retryTranslate();
    } else {
      void runScan(current);
    }
  }

  const scanning = state.stage === "scanning" || state.stage === "translating";
  const hasRun = state.stage !== "idle";
  const stepperStage: StageName =
    state.stage === "ready"
      ? "ready"
      : state.stage === "translating" || state.stage === "paused"
        ? "translating"
        : "scanning";
  const showStepper = hasRun;
  const ready = state.stage === "ready" ? state.report : null;

  return (
    <Fragment>
      <section
        className="mx-auto w-full max-w-2xl px-6 py-10"
        aria-labelledby="scan-form-heading"
      >
      <h2
        id="scan-form-heading"
        className="text-xl font-semibold leading-7 text-on-surface"
      >
        Run a new scan
      </h2>

      <form onSubmit={handleSubmit} noValidate className="mt-4">
        <label
          htmlFor="scan-url"
          className="text-sm font-medium text-on-surface-variant"
        >
          Website URL
        </label>
        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <input
            ref={inputRef}
            id="scan-url"
            type="url"
            required
            aria-required="true"
            value={url}
            onChange={(event) => {
              setUrl(event.target.value);
              if (validationError) setValidationError(null);
            }}
            placeholder="https://example.com"
            aria-invalid={validationError ? true : undefined}
            aria-describedby={validationError ? "scan-url-error" : undefined}
            className={`${INPUT_CLASSES} ${validationError ? "border-error" : ""}`}
          />
          <button type="submit" className={BUTTON_CLASSES} disabled={scanning}>
            {scanning ? "Scanning…" : "Run scan"}
          </button>
        </div>
        {validationError && (
          <p
            id="scan-url-error"
            role="alert"
            className="mt-2 text-sm font-medium text-error"
          >
            {validationError}
          </p>
        )}
      </form>

      {!hasRun && !submittedUrl && (
        <p className="mt-6 rounded-md border border-outline bg-surface-container p-4 text-on-surface-variant">
          {EMPTY_STATE_COPY}
        </p>
      )}

      {showStepper && (
        <div className="mt-6" role="status" aria-live="polite">
          <p className="sr-only">{STAGE_ANNOUNCEMENT[stepperStage]}</p>
          <ProgressStepper current={stepperStage} />
        </div>
      )}

      {state.stage === "failed" && (
        <div
          role="alert"
          className="mt-6 rounded-md border border-error-container bg-error-container p-4"
        >
          <p className="font-medium text-on-error-container">{state.hint}</p>
          <button type="button" onClick={handleRetry} className={RETRY_CLASSES}>
            Retry
          </button>
        </div>
      )}

      {state.stage === "paused" && (
        <div
          role="status"
          aria-live="polite"
          className="mt-6 rounded-md border border-warning-container bg-warning-container p-4"
        >
          <p className="font-medium text-on-warning-container">{PAUSED_COPY}</p>
          <button type="button" onClick={handleRetry} className={RETRY_CLASSES}>
            Retry
          </button>
        </div>
      )}
      </section>

      {ready && <ReportSurface report={ready} />}
    </Fragment>
  );
}