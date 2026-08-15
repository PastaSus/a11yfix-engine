---
title: '1-1: Capture a structured scan of a public URL'
type: 'feature'
created: '2026-08-13'
status: 'done'
baseline_commit: '2162cdab6a109cd1bc14fc28aa2a3b3da99f86c8'
review_loop_iteration: 1
context: []
---

<!-- Target: 900–1300 tokens. Above 1600 = high risk of context rot.
     Never over-specify "how" — use boundaries + examples instead.
     Cohesive cross-layer stories (DB+BE+UI) stay in ONE file.
     IMPORTANT: Remove all HTML comments when filling this template. -->

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A user submitting a public URL for accessibility/performance audit receives no structured output — the scan either crashes or returns raw DOM violations without vitals, schema validation, or typed error handling. There is no shared contract between the Python scanner service and the Next.js web tier, and no way to reject malformed URLs before launching headless browsers.

**Approach:** Establish the monorepo foundation (pnpm workspace: `apps/web` + `services/scanner` + `contracts/`), define the canonical `ScanResult` envelope schema with `schemaVersion`, and build the Python FastAPI scanner that validates URLs with typed errors, runs axe-core via Playwright, and returns a schema-validated `ScanResult` envelope (violations + vitals). This is the Harvest stage — every later epic (translate, present, export) consumes this envelope.

</frozen-after-approval>

## Boundaries & Constraints

**Always:**

- Repository is a pnpm workspace monorepo: `apps/web` (Next.js tier), `services/scanner` (Python FastAPI), `contracts/` (shared JSON Schema). Dependency direction: `web→contracts`, `scanner→contracts`. Web and scanner communicate only over HTTP.
- Exactly one canonical `AuditReport` JSON Schema lives in `contracts/`. Both the Python scanner's parsed output and the TS/React types are generated/validated from it. `schemaVersion` is mandatory.
- Python service is a stateless HTTP filter: `POST /scan` → `ScanResult` envelope. No business state, no storage, synchronous request → result. Cancellation via standard HTTP.
- Error envelope convention: `{ code, message, stage }`. All errors return this shape with HTTP status reflecting severity.
- Scans complete within a configurable timeout; they never hang indefinitely.
- Public pages only; no user credentials or session data stored.

**Ask First:**

- Default timeout and depth behavior for heavy pages — configurable per-Scan or global MVP default? (OQ-5)
- Which free-tier AI provider(s) cover both personas reliably? (OQ-1) — not needed for 1.1 but relevant for later epics.
- Default WCAG rule set for axe-core defaults (OQ-5).

**Never:**

- Scanning URLs requiring login, session state, or site credentials.
- Auto-applying generated Patches to any repository.
- Allowing the Python service to grow state (queues, storage, business data).
- Shipping without `schemaVersion` in the envelope — this is the single highest-integrity gate for the pipeline.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| **HAPPY_PATH** | Valid `https://` URL submitted to `/scan` | `ScanResult` envelope returned with `schemaVersion`, `violations` array, `vitals` block keyed by `scanId` (ULID). HTTP 200. | N/A |
| **ERROR_CASE** | Malformed URL (unparseable) submitted to `/scan` | Typed error `{ code: "invalid_url", message: "..."`stage: "validate" }` returned with HTTP 400. Headless browser **never** launched. | Validation error, no browser launched |
| **ERROR_CASE** | Non-`https://` URL (e.g. `http://`, `ftp:`, `javascript:`) submitted | Typed error `{ code: "insecure_url", message: "..."`stage: "validate" }` returned with HTTP 400. Headless browser **never** launched. | Same — before any browser start |
| **ERROR_CASE** | Unreachable host / DNS failure / connection refused | Typed error `{ code: "unreachable", message: "..."`stage: "harvest" }` returned. Never an unhandled exception / crash. | Graceful typed failure |

</frozen-after-approval>

## Code Map

- `contracts/scan-result.schema.json` — canonical ScanResult envelope shape (violations + vitals + schemaVersion). Validates every scan output.
- `contracts/audit-report.schema.json` — canonical AuditReport envelope (two schema versions of same envelope; `schemaVersion` mandatory). Enriched: violations + vitals + analyst impacts + architect patches.
- `services/scanner/app/main.py` — FastAPI app, `POST /scan` entrypoint. Accepts `{ url: str }`, validates scheme, launches Playwright, runs axe-core, returns ScanResult envelope or typed error.
- `services/scanner/app/validation.py` — URL scheme validation (https-only). Returns typed `{ code, message, stage }` error before any headless browser launch.
- `services/scanner/app/harvest.py` — Playwright + axe-core: navigate to URL, wait for page load, inject axe-core, run analysis, extract violations + vitals, build ScanResult envelope.
- `services/scanner/app/errors.py` — Typed error shapes and FastAPI exception handlers for `validation_error` and `harvest_error`.
- `apps/web/app/api/scan/route.ts` — Next.js Route Handler that proxies POST to Python scanner service (`http://services/scanner:8000/scan`). Verifies the web→scanner HTTP seam. (This route will be fully wired in story 1.4, but the minimal route is included here to demonstrate the orchestrator pattern and enable immediate end-to-end testing via `pnpm dev`.)
- `_bmad-output/implementation-artifacts/epic-1-context.md` — compiled epic context loaded at dispatch time.

## Tasks & Acceptance

- [x] `contracts/scan-result.schema.json` — Define ScanResult envelope: `schemaVersion` (literal `"1.0.0"`), `scanId` (ULID string), `url` (input string), `violations` (array of violation objects with `id`, `impact`, `description`, `helpUrl`, `nodes` array with `nodeId`, `coordinates`), `vitals` (object with `lcp`, `inp`, `cls` — numeric | null; present but zeroed for 1.1; 1.3 fills real values), `timestamp` (ISO-8601 UTC). Include JSON Schema `definitions` or `properties` with `additionalProperties: false` on the envelope.
- [x] `contracts/audit-report.schema.json` — Define AuditReport envelope: `schemaVersion` (same `"1.0.0"`), `scanId` (matches ScanResult), `violations` (same as ScanResult), `vitals` (same as ScanResult), `analyst_impacts` (array of analyst impact blocks, each with `violation_id`, `business_problem`, `affected_segment`, `wcag_consequence`, `conversion_impact_estimate`), `architect_patches` (array of patch objects with `status: "proposed"`, `diff`, `rationale`, `wcag_rule`). Note: analyst/architect fields populated in later epics; scaffold structure now.
- [x] `services/scanner/app/validation.py` — URL scheme validator: reject `http://`, `ftp:`, `javascript:`, unparseable strings. Return `{ code, message, stage }` error with HTTP 400. This validation runs **before** any Playwright browser launch.
- [x] `services/scanner/app/harvest.py` — Playwright-based harvest: `page.goto(url, timeout=30000)`, `page.wait_for_load_state('networkidle')` (or timeout-bound wait), inject axe-core minified JS via `page.add_script_tag(content=...)`, `await page.evaluate('() => { return window.axe.run(); }')`, extract `violations` array and `vitals` ({ lcp, inp, cls }) from the result. On `TimeoutError` / `NavigationError` → raise typed harvest error.
- [x] `services/scanner/app/main.py` — FastAPI app: `POST /scan` endpoint. Accept `{ url: str }` via Pydantic model. Run `validation.py` first. If valid → run `harvest.py`. On success, return ScanResult envelope (HTTP 200). On validation error → return typed error (HTTP 400). On harvest error → return typed failure (HTTP 502/422). Include `ulid` generation for `scanId`. Add `FastAPI` dependency: `fastapi`, `uvicorn`, `playwright`, `axe-core` (pip), `ulid-py` (pip).
- [x] `apps/web/app/api/scan/route.ts` — Next.js Route Handler: `export async function POST(request: Request) { const { url } = await request.json(); const res = await fetch('http://127.0.0.1:8000/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }); const data = await res.json(); return Response.json(data); }`. This proves the web→scanner HTTP seam and enables `pnpm dev` testing without Docker. (Full production orchestration with Docker compose is v2+.)
- [x] Self-review against READY FOR DEVELOPMENT standard: every task has a file path and specific action; tasks ordered by dependency; all AC use Given/When/Then; no placeholders or TBDs; no known requirement/acceptance/dependency gaps remain; coherent with no unresolved ambiguities or internal contradictions.

## Acceptance Criteria (from story 1.1)

- **Given** a valid `https://` URL
- **When** it is submitted to the scan API
- **Then** a `ScanResult` envelope is returned containing `violations` and `vitals`, validated against the shared `contracts/` JSON Schema with `schemaVersion` present
- **And** a malformed or non-`https://` URL is rejected with a typed `{ code, message, stage }` error before any headless browser launches
- **And** an unreachable host returns a typed failure, never an unhandled exception

## Design Notes

- The `vitals` block is included in the ScanResult envelope from story 1.1 with the correct schema shape, but actual metric measurement (LCP, INP, CLS) is implemented in story 1.3. In 1.1 the fields are present keyed by scanId but may be `null`; story 1.3 fills real measurements. This keeps the envelope shape stable across epics.
- The `contracts/scan-result.schema.json` and `contracts/audit-report.schema.json` are two schema versions of the same envelope (ADR-3). `schemaVersion` is mandatory on both. The scanner validates output against `scan-result.schema.json` in 1.1; the web tier validates against `audit-report.schema.json` starting in 1.2.
- URL validation is strict: only `https://` scheme is accepted. `http://` is rejected as insecure before any browser launch. Other unparseable inputs are also rejected. This satisfies FR-1's "malformed or non-https URL is rejected with a clear validation error before any headless browser launches" and ADR-8's `{ code, message, stage }` error envelope.
- The Python service is intentionally minimal: stateless HTTP filter, no storage, no AI calls, no UI. It knows nothing about the dashboard, reports, or export — only how to harvest a page with Playwright + axe-core and return the envelope. The Next.js tier is the sole orchestrator (ADR-1).
- Error envelope: all errors from the scanner return `{ code, message, stage }`. HTTP status codes map: validation error → 400, harvest error → 502 (or 422 for business logic). The `stage` values are `"validate"` and `"harvest"` to trace where failure occurred. This is the convention from ADR-8.

## Verification

**Commands:**

- `uv run python -m pytest services/scanner/tests/ -v` — run scanner test suite (unit + integration). On CI: `playwright install` browsers before suite. Target: 100% of AC paths pass.
- `uv run python -c "from services.scanner.app.validation import validate_url; print(validate_url('https://example.com'))"` — quick smoke test URL validation.
- `uv run python -c "from services.scanner.app.main import app; print('import OK')"` — verify FastAPI app imports cleanly.

**Manual checks (if no CLI):**

- Submit `https://www.udemy.com` (or any valid public URL) via `curl -X POST http://127.0.0.1:8000/scan -d '{"url":"https://example.com"}'` — verify ScanResult envelope returned with `schemaVersion`, `violations` array, `vitals` block. Confirm schema validation passes.
- Submit `http://example.com` (insecure) — verify typed `{ code, message, stage }` error returned with HTTP 400, **before** any browser launches.
- Submit `https://nonexistent-domain-xyz123.com` — verify typed `{ code: "unreachable", message, stage: "harvest" }` error returned with HTTP 502, **never** an unhandled exception/crash.
- Submit garbage string `"not-a-url"` — verify validation error with HTTP 400.

**Manual checks (if no CLI, continued):**

- Run `pnpm dev` at repo root — verify `http://127.0.0.1:3000/api/scan` route handler works and proxies to the Python scanner. Confirm the web→scanner HTTP seam is functional for end-to-end testing without Docker.

---

*Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change.*

## Suggested Review Order

**Pipeline entry point and envelope integrity**

- The single orchestrator seam: POST /scan validates, harvests, and schema-validates the output.
  [`main.py:68`](../../services/scanner/app/main.py#L68)

- Envelope built with vitals keyed by scanId, schemaVersion pinned — the intake every epic depends on.
  [`harvest.py:64`](../../services/scanner/app/harvest.py#L64)

- Output conformance enforced before it leaves the service — a scanner that builds bad envelopes fails loudly here.
  [`main.py:47`](../../services/scanner/app/main.py#L47)

**Validation and typed errors**

- https-only gate runs before any browser launch; rejects malformed/insecure/out-of-range ports.
  [`validation.py:17`](../../services/scanner/app/validation.py#L17)

- `{ code, message, stage }` envelope + FastAPI validation converted to the same shape.
  [`errors.py:32`](../../services/scanner/app/errors.py#L32)

- Navigation timeout, CSP/axe failure, and unreachable host now map to distinct typed codes.
  [`harvest.py:76`](../../services/scanner/app/harvest.py#L76)

**Web tier seam**

- Proxy forwards the scanner's status code, guards malformed bodies, and times out a wedged scanner.
  [`route.ts:4`](../../apps/web/app/api/scan/route.ts#L4)

**Contract schemas**

- Canonical ScanResult envelope — the interchange contract for every pipeline consumer.
  [`scan-result.schema.json:1`](../../contracts/scan-result.schema.json#L1)

- Enriched second schema version scaffolding analyst impacts and proposed-only patches for 1.2+.
  [`audit-report.schema.json:1`](../../contracts/audit-report.schema.json#L1)

**Monorepo restructure**

- pnpm workspace now declares apps/ and contracts/ packages; web→contracts link.
  [`pnpm-workspace.yaml:1`](../../pnpm-workspace.yaml#L1)

- Root scripts delegate to the web workspace after the app moved into apps/web.
  [`package.json:1`](../../package.json#L1)

**Tests and tooling**

- Endpoint tests cover all I/O matrix rows including the chromium-gated live scan and typed failures.
  [`test_main.py:15`](../../services/scanner/tests/test_main.py#L15)

- Wall-clock timeout branch now exercised; envelope+extraction logic schema-tested without a browser.
  [`test_harvest.py:59`](../../services/scanner/tests/test_harvest.py#L59)

- URL validation edge cases parametrized across schemes, malformed hosts, and ports.
  [`test_validation.py:11`](../../services/scanner/tests/test_validation.py#L11)

- uv-managed Python env, pytest config, and toolchain pins for the scanner.
  [`pyproject.toml:1`](../../pyproject.toml#L1)

### Review Findings

**decision-needed**

**patch**

- [x] [Review][Patch] extract_violations builds garbage nodeId / crashes on real axe target shape — `target` is an array-of-arrays, so `" > ".join(target)` emits a Python list repr (or a TypeError when the first element is itself a list), never a usable selector [services/scanner/app/harvest.py:49]
- [x] [Review][Patch] axe.run() result unguarded — a null/non-dict return (CSP-blocked axe or inject failure) raises an AttributeError, an untyped 500, not a typed HarvestError [services/scanner/app/harvest.py:107]
- [x] [Review][Patch] No catch-all exception handler — any unhandled exception leaks FastAPI's default HTML 500, breaking the ADR-8 `{ code, message, stage }` contract [services/scanner/app/errors.py:48]
- [x] [Review][Patch] validate_url accepts empty-hostname URLs (`https://:443` passes) and whitespace/invalid hostname chars — a browser launches for a malformed host instead of a typed 400 [services/scanner/app/validation.py:38]
- [x] [Review][Patch] validate_envelope enforcement branch untested — no test routes a tampered envelope through the gate to assert a 502 `schema_error` [services/scanner/app/main.py:47]
- [x] [Review][Patch] Draft7Validator built without format_checker — the `format: date-time` on `timestamp` is silently never validated [services/scanner/app/main.py:43]
- [x] [Review][Patch] No test for a non-string `url` body (`{"url": 123}`) exercising the 422 `invalid_request` handler [services/scanner/tests/test_main.py:58]
- [x] [Review][Patch] scanId schema pattern never asserted against a real `ulid.new()` output — only the hardcoded all-zero ULID [services/scanner/tests/test_harvest.py:94]
- [x] [Review][Patch] .gitignore ignores `playwright-report/` but not `test-results/`, the directory pytest-playwright writes to [.gitignore]
- [x] [Review][Patch] route.ts reads `res.text()` outside any try — a scanner body read that fails or stalls is an unhandled exception, not a typed 502 [apps/web/app/api/scan/route.ts:37]
- [x] [Review][Patch] route.ts doesn't strip a trailing slash from SCANNER_URL — `SCANNER_URL=https://host/` yields `//scan` → 404 [apps/web/app/api/scan/route.ts:1]

**defer**

- [x] [Review][Defer] No concurrency bound on headless instances — every `/scan` launches its own Chromium; bounded-instance budget belongs to story 1.3 (NFR-1) [services/scanner/app/main.py:67] — deferred, pre-existing
- [x] [Review][Defer] Cancellation via HTTP disconnect unimplemented; `asyncio.wait_for` cancels `run_scan` mid-`finally: await browser.close()` risking a leaked browser process [services/scanner/app/main.py:72] — deferred, pre-existing
- [x] [Review][Defer] Zero observability — no scanId/duration/stage logging; pipeline stage timings (NFR-5, ADR-7) are epic-level [services/scanner/app/harvest.py:76] — deferred, pre-existing
- [x] [Review][Defer] networkidle wait timeout swallowed with `pass` — SPA-render awareness ("axe runs only after render") is explicit story 1.2 scope [services/scanner/app/harvest.py:100] — deferred, pre-existing
- [x] [Review][Defer] ScanResult/AuditReport duplicate shared definitions and AuditReport already drops `url`/`timestamp` from `required` — schema duplication is already tracked in the deferred-work ledger [contracts/audit-report.schema.json:8] — deferred, pre-existing
- [x] [Review][Defer] Chromium-gated live tests silently skip without the browser binary and depend on `https://example.com` (network flake) — CI enforcement is deferred post-MVP [services/scanner/tests/test_main.py:15] — deferred, pre-existing
- [x] [Review][Defer] No automated coverage for the web→scanner proxy seam (route.ts) — pinned when story 1.4 builds the submission UI [apps/web/app/api/scan/route.ts:4] — deferred, pre-existing
- [x] [Review][Defer] Private/loopback/link-local hosts scannable — needs a product decision before SSRF-style guard with story 1.4 [services/scanner/app/validation.py:38] — deferred, pre-existing
- [x] [Review][Defer] Severity vocabulary drift — axe emits `critical/serious/moderate/minor`; the epic fixes `critical/moderate/minor`; render mapping belongs to Epic 3 [contracts/scan-result.schema.json:61] — deferred, pre-existing
- [x] [Review][Defer] Vendored `axe.min.js` ships with no provenance record; ruff configured but not in the dev dependency group [services/scanner/app/axe.min.js:1] — deferred, pre-existing
- [x] [Review][Defer] scanner→contracts coupling via hardcoded relative path, not a declared dependency — acknowledged in deferred-work ledger [services/scanner/app/main.py:25] — deferred, pre-existing
- [x] [Review][Defer] route.ts error codes are hardcoded strings not validated against the shared contract; `invalid_url/400` (route) vs `invalid_request/422` (scanner) inconsistent for the same failure class [apps/web/app/api/scan/route.ts:10] — deferred, pre-existing
- [x] [Review][Defer] `conversion_impact_estimate` typed as `string` can't be compared/summed — forces Epic 3 web tier to parse free text [contracts/audit-report.schema.json:149] — deferred, pre-existing