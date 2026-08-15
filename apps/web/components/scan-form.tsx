"use client";

import { useRef, useState } from "react";
import { ProgressStepper } from "@/components/progress-stepper";
import type { StageName } from "@/components/progress-stepper";
import { submitScan } from "@/lib/scan";
import type { ScanResult } from "@/lib/scan";
import { validateScanUrl } from "@/lib/validate-scan-url";

const EMPTY_STATE_COPY = "No scans yet — paste a URL to run your first audit.";
const PAUSED_COPY = "Translation is waiting on a free-tier limit — retrying.";
const GENERIC_FAILURE_HINT = "Something went wrong while scanning — try again in a moment.";
const TRANSLATING_PASS_THROUGH_MS = 400;

const STAGE_ANNOUNCEMENT: Record<StageName, string> = {
  scanning: "Scanning your site.",
  translating: "Translating results.",
  ready: "Scan ready.",
};

type ScanState =
  | { stage: "idle" }
  | { stage: "scanning" }
  | { stage: "translating" }
  | { stage: "ready"; result: ScanResult }
  | { stage: "failed"; hint: string }
  | { stage: "paused" };

const FAILURE_HINTS: Record<string, string> = {
  unreachable: "We couldn't reach that site — it may be down, or the network is slow.",
  timeout: "The scan timed out — the site may be too slow to respond.",
  invalid_url: "That address looks invalid — check it and try again.",
  insecure_url: "That address isn't a secure https:// URL.",
  scan_error: GENERIC_FAILURE_HINT,
};

function failureHint(code: string): string {
  return FAILURE_HINTS[code] ?? GENERIC_FAILURE_HINT;
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
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

  async function runScan(target: string) {
    if (inflight.current) return;
    inflight.current = true;
    try {
      setState({ stage: "scanning" });
      const result = await submitScan(target);
      if (result.ok) {
        setState({ stage: "translating" });
        await new Promise((resolve) => setTimeout(resolve, TRANSLATING_PASS_THROUGH_MS));
        setState({ stage: "ready", result: result.data });
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
    if (current !== "") {
      const error = validateScanUrl(current);
      if (error) {
        setValidationError(error);
        inputRef.current?.focus();
        return;
      }
      setValidationError(null);
      void runScan(current);
      return;
    }
    if (submittedUrl) {
      void runScan(submittedUrl);
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
  const ready = state.stage === "ready" ? state.result : null;

  return (
    <section className="mx-auto w-full max-w-2xl px-6 py-10" aria-labelledby="scan-form-heading">
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

      {ready && (
        <dl
          className="mt-6 rounded-md border border-outline bg-surface p-4"
          role="status"
          aria-live="polite"
        >
          <div className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
            <DtDd term="URL" value={ready.url} />
            <DtDd
              term="Violations"
              value={`${ready.violations.length} ${ready.violations.length === 1 ? "violation" : "violations"}`}
            />
            <DtDd
              term="LCP"
              value={ready.vitals.lcp === null ? "Not measured" : `${Math.round(ready.vitals.lcp)} ms`}
            />
            <DtDd
              term="CLS"
              value={ready.vitals.cls === null ? "Not measured" : String(ready.vitals.cls)}
            />
            <DtDd term="Scanned at" value={formatTimestamp(ready.timestamp)} />
          </div>
        </dl>
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
  );
}

function DtDd({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1">
      <dt className="text-xs font-semibold uppercase tracking-[0.04em] text-on-surface-variant">
        {term}
      </dt>
      <dd className="font-mono text-sm tabular-nums text-on-surface">{value}</dd>
    </div>
  );
}