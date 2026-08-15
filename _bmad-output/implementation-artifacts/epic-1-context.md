# Epic 1 Context: Run a Site Audit

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Scan any public URL and get back structured accessibility violations plus Core Web Vitals. A Python scanner drives headless Chromium with Playwright and axe-core, waits for single-page-app content to render, and returns a normalized, schema-validated result the web tier can persist and later feed to the AI personas. The web tier also lets a user submit a URL and watch the pipeline progress. This is the Harvest stage — the machine-readable foundation every later epic (translate, present, export) consumes.

## Stories

- Story 1.1: Capture a structured scan of a public URL
- Story 1.2: Harvest the DOM with SPA-render awareness
- Story 1.3: Capture Core Web Vitals in the audit
- Story 1.4: Submit a scan from the web and watch progress

## Requirements & Constraints

- Only valid `https://` public URLs scan. Malformed or non-https URLs are rejected with a typed validation error before any headless browser launches.
- An unreachable host returns a typed failure the dashboard renders — never an unhandled exception.
- axe-core runs only after the page has rendered; violations in later-rendered (deferred) nodes must be captured, not the empty shell.
- Scans complete within a configurable timeout or return a typed timeout status; they never hang indefinitely.
- Each scan returns LCP, INP, and CLS measured from the same page load, merged into the report keyed by the same scan ID as the violations.
- Scans run within a bounded resource profile (bounded headless instances, bounded timeout) so parallel local runs stay within a modest machine's budget.
- Public pages only; no credentials or session data stored. Scanning behind login is out of scope.
- Target: median end-to-end scan-to-report time under ~3 minutes for a typical marketing page.
- Scan failures are retryable and produce typed failures with a cause hint (HTTP, DNS, timeout).
- Web-side submit validates inline (never a toast), starts the pipeline immediately, and shows named stages Scanning → Translating → Ready; an unrecoverable stage shows a failed state with Retry + cause hint, and a rate-limit pause is a distinct state, not a hard failure.

## Technical Decisions

- Three-stage pipes-and-filters pipeline (harvest → translate → present). The Next.js tier is the only orchestrator: it calls the Python service, runs the personas, serves the dashboard. The Python service never initiates work, never calls AI, and never renders UI.
- Scanner is a stateless HTTP filter: `POST /scan` → `ScanResult` envelope; no business state, no storage; synchronous request → result.
- Exactly one canonical JSON Schema lives in `contracts/` and is the single interchange contract across both languages (Python and TS validate/generate from it). `schemaVersion` is mandatory. `ScanResult` (raw: violations + vitals) and `AuditReport` (enriched) are two schema versions of the same envelope; no other format crosses the tier boundary.
- Reports are immutable; re-scanning produces a new `scanId` (ULID). Dates are ISO-8601 UTC. Severity vocabulary is fixed: critical / moderate / minor. Violations carry `nodeId`s.
- Error envelope convention: `{ code, message, stage }`.
- Monorepo: pnpm workspace with `apps/web`, `services/scanner` (Python), `contracts/`; dependency direction web→contracts, scanner→contracts; web and scanner communicate only over HTTP.
- Stack: Python 3.12+, FastAPI harness, Playwright (Python driver), axe-core; scan payload via `@axe-core/playwright` shape or direct axe injection.
- Pipeline stage timings (scan → translate → render) are logged for observability.

## UX & Interaction Patterns

- Scan form: URL input with inline (non-toast) validation on malformed URL; submit starts the pipeline immediately.
- Scan progress: named stages Scanning → Translating → Ready; an unrecoverable stage shows a Retry plus a cause hint; a rate-limit pause ("waiting on a free-tier limit — retrying") is visually distinct from a hard failure.
- Home empty state reads "No scans yet — paste a URL to run your first audit."
- Errors use human language (e.g., "We couldn't reach that site — it may be down, or the network is slow"), never raw status codes.

## Cross-Story Dependencies

- 1.1 depends on the shared contracts schemas; 1.2 and 1.3 build on 1.1's scan harness. 1.4 consumes the scan API and error envelope surfaced by 1.1.
- 1.1–1.3 produce the `ScanResult` envelope that Epic 2's personas consume; 1.3's vitals also feed Epic 3's Developer View.
- 1.4's progress surface shows the Translating stage, which is implemented in Epic 2 — the stage naming and state contract is fixed here.
