# Deferred Work

Ledger of real findings surfaced in review that are not this story's problem. Reviewed during sprint sweep (`bmad-loop-sweep`) and before planning each following story.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: ScanResult and AuditReport schemas duplicate shared violations/vitals definitions and both pin schemaVersion "1.0.0" while being structurally incompatible envelopes.
  evidence: The web tier first consumes `audit-report.schema.json` in story 1.2; version/definition drift across the two files will bite there. Decide the versioning scheme (per-shape vs shared base `$ref`) when 1.2 lands.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: Severity vocabulary drifts — axe-core emits `critical/serious/moderate/minor` but the epic context fixes `critical/moderate/minor`.
  evidence: The schema enum already carries axe's native set; the render mapping to the UX-token vocabulary (critical/moderate/minor) belongs to Epic 3's report surface.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: "Public pages only" is not enforced at the network level — private/loopback/link-local hosts are scannable.
  evidence: Hunted in review. Dev-local scanning (e.g. `https://127.0.0.1`) may be desirable pre-hosted-tier; needs a product decision before SSRF-style guard or explicit dev-mode carve-out lands with story 1.4.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: No automated coverage for the web→scanner proxy seam (route.ts), and no CI workflow enforces lint/build/test.
  evidence: Route handler is verified only by manual `pnpm dev`; the seam gets real fixtures when story 1.4 builds the submission UI. A CI pipeline was deferred post-MVP by the architecture spine.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: `@darkhouse/contracts` is declared but unused by the web tier in 1.1, and no TS types are generated from the schemas.
  evidence: Web-side schema validation/types begin when the web tier owns an audit report (stories 1.2/1.3). The package skeleton is correct.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: Scanner has no `/health` endpoint and is runnable only from the repo root (package=false, cwd on sys.path).
  evidence: A liveness probe and launch recipe become necessary when the web tier orchestrates the pipeline (story 1.4); a console-script/uvicorn entrypoint can ride along.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: Vendored `axe.min.js` (axe v4.11.4) ships with no provenance or re-vendor record, and `ruff` is configured in pyproject but not in the dev dependency group.
  evidence: Blind-hunter finding. Provenance belongs in a scanner README; pinning ruff (and adding CI) is covered by the deferred CI item above.

## Deferred from: code review of spec-1-1 (2026-08-15)

- No concurrency bound on headless instances — every `/scan` launches its own Chromium; bounded-instance budget belongs to story 1.3 (NFR-1).
- Cancellation via HTTP disconnect unimplemented; `asyncio.wait_for` cancels `run_scan` mid-`finally: await browser.close()` risking a leaked browser process.
- Zero observability — no scanId/duration/stage logging; pipeline stage timings (NFR-5, ADR-7) are epic-level.
- networkidle wait timeout swallowed with `pass` — SPA-render awareness ("axe runs only after render") is explicit story 1.2 scope.
- ScanResult/AuditReport duplicate shared definitions and AuditReport already drops `url`/`timestamp` from `required` — schema duplication tracked above.
- Chromium-gated live tests silently skip without the browser binary and depend on `https://example.com` (network flake) — CI enforcement is deferred post-MVP.
- No automated coverage for the web→scanner proxy seam (route.ts) — pinned when story 1.4 builds the submission UI.
- Private/loopback/link-local hosts scannable — needs a product decision before SSRF-style guard with story 1.4.
- Severity vocabulary drift — axe emits `critical/serious/moderate/minor`; the epic fixes `critical/moderate/minor`; render mapping belongs to Epic 3.
- Vendored `axe.min.js` ships with no provenance record; ruff configured but not in the dev dependency group.
- scanner→contracts coupling via hardcoded relative path, not a declared dependency.
- route.ts error codes are hardcoded strings not validated against the shared contract; `invalid_url/400` (route) vs `invalid_request/422` (scanner) inconsistent for the same failure class.
- `conversion_impact_estimate` typed as `string` can't be compared/summed — forces Epic 3 web tier to parse free text.

## Deferred from: code review of spec-1-2 (2026-08-15)

- Non-timeout `PlaywrightError` from `wait_for_load_state`/`page.evaluate` escapes `wait_spa_ready` (harvest.py:181-184) and is re-labeled `{ code: "unreachable" }` by `run_scan`'s outer handler — typed and bounded, but the message ("couldn't reach URL") misreports a target-crash/closed-page cause. Distinguish `target crashe`/`closed` `PlaywrightError`s when browser-crash observability lands (epic observability item).
- The DOM-stability loop checks the budget only between iterations, so one hung `page.evaluate` can exceed the 15s fallback by up to one Playwright action-timeout (~30s default). Still bounded; `run_scan_with_timeout` (120s) remains the backstop. Consider setting an explicit `page.set_default_timeout` on the probe when hardening.
- Worst-case pre-axe wait on a never-idle + never-stable page is \~45s (30s networkidle + 15s stability) plus navigation — sequential budgets are spec-frozen; revisit if NFR-2 latency targets tighten.
- Fingerprint is `document.body.innerHTML.length` only; length-preserving churn (same-length text swap, attribute swap, node reorder) reads as stable. Spec chose this scalar; a richer fingerprint (e.g. element-count + length hash) can ride a future SPA-hardening story.
- `test_deferred_spa_captures_late_violations` depends on `networkidle` firing only after `/slow` (~1.2s) resolves while the img inserts at ~300ms; under heavy CI delays the timer could fire late and the test flakes. Harden by waiting on an explicit selector or widening the `/slow` window.
- No end-to-end assertion that `code:"timeout"` surfaces as HTTP 502 via `POST /scan`; proven transitively through the same `errors.py` handler that `test_main` covers. Direct assertion can ride story 1.4's seam fixtures.
- No offline deterministic test pins the static-page EDGE_CASE (existing live test `test_happy_path_live_scan` skips offline). A cheap static fixture + short budget test can close it when SPA fixtures are next touched.

## Deferred from: code review of spec-1-3 (2026-08-15)

- CLS is a raw accumulated sum, not the web-vitals session-window metric; on long-lived/infinite-scroll pages it over-reports versus the standard. Full web-vitals semantics (session windows, LCP revocation, renderTime) are a fancier probe — deferred to a vitals-fidelity hardening story when Epic 3 renders exact numbers.
- LCP takes the last candidate's `startTime`, ignoring revocation semantics and `renderTime`; acceptable for short single-page-load scans, matches the "cheap scalar, bounded scan" constraint.
- Vitals are read with no observer flush; a shift in the final milliseconds before the read can be missed (non-deterministic under load). Bounded scans make this low-impact; revisit with session-window work.
- The `MAX_CONCURRENT_SCANS` bound is per-process (module-level semaphore); under multiple uvicorn workers effective concurrency is `3 × workers`. Intentional under "slotting only, no shared state"; revisit when a hosted tier lands.
- Slot constants (`MAX_CONCURRENT_SCANS`, `SCAN_SLOT_TIMEOUT_MS`) are hardcoded with no env override. Tuning via env/config belongs with the observability/ops story.
- `_chromium_available()` is copy-pasted in test_main/test_spa_render/test_vitals and each copy launches a real browser at collection time. Consolidate into `conftest.py` (session-cached) when the test seam is next touched.
- The "observers never fire" I/O row has no live-browser test (only unit coverage of `collect_vitals`); a real blob/blank page reading is unpinned. Cheap to add with a bare fixture when SPA fixtures are next touched.
- The "same page load" invariant (vitals from the same navigation as axe) is not test-observable — both observers use `buffered: true`, so a regression that re-navigated before reading would still pass. Mechanism-pinning test deferred as flake-prone.
- No test exercises N simultaneous `/scan`s through the real shared `_SCAN_SLOT` happy path (unit tests cover single-slot acquire). A bounded-capacity concurrency integration test can ride story 1.4's progress-workflow fixtures.

## Deferred from: code review of spec-1-4 (2026-08-15)

- No client-side timeout or cancel on `submitScan`: the route's own 130s `AbortSignal` bounds the stalled `scanning` state, but a hung proxy leaves the form stuck with submit/Retry locked. A client timeout + cancel affordance belongs with the Epic 2 translate/retry workflow.
- IPv6 hosts (`https://[::1]`, global addresses) are rejected by both the client validator and the scanner (`HOSTNAME_PATTERN` does not allow `:`); enabling IPv6 scans is a co-engineered client+scanner product decision for a later story.
- Client/scanner host-name divergence for IDN/unicode URLs: `validateScanUrl` accepts `https://bücher.de` (the browser URL API punycode-normalizes the host), but the raw unicode host is POSTed and the scanner rejects it (`ü` not in `[A-Za-z0-9.\-]`), surfacing a confusing "invalid hostname" failure. Fix direction: punycode-normalize before POST or mirror the ASCII-host rule in the client.
- DESIGN.md-pinned tokens need an a11y pass in story 3.1's foundation: `--color-outline #94a3b8` on `--color-surface #f8fafc` is below WCAG 1.4.11's 3:1 non-text contrast, and the palette stays light-only in dark OS schemes (a `color-scheme` declaration and token variants belong with the 3.1 token foundation).
- Paused copy "Translation is waiting on a free-tier limit — retrying." is spec-frozen but 1.4 has no auto-retry; auto-resume/backoff belongs with the Epic 2 translate pipeline.
- The ready surface intentionally shows only count + LCP/CLS + timestamp (1.4 happy path); violation details and INP render with Epic 3's report surface. Retaining the last-good result across re-runs is also a later report-epic concern.

## Deferred from: code review of spec-2-1 (2026-08-16)

- `AuditReport.schemaVersion` is a passthrough of the ScanResult's version; the two canonical schemas pin the same `1.0.0` today, but the versioning scheme for the enriched envelope (per-shape vs shared base) is still undecided from the spec-1-1 deferral — revisit when the web tier gains schema validation.
- Hand-written `AuditReport`/`AnalystImpact` TS types are not generated from `contracts/audit-report.schema.json`, so type↔schema drift is only caught by tests; the web tier still has no runtime schema-validation pass (deferred `@darkhouse/contracts` item). This is the AC-2 "no schema validation" gap.
- `MAX_TOKENS = 1024` is fixed regardless of high-severity violation count and `finish_reason` is never inspected; a truncation would surface as a `translate_error` (bounded, typed) rather than a retry with a bigger budget. Consider dynamic budget when many violations land.
- `extractJsonArray` slices between the first `[` and last `]`; a provider reply wrapped in prose/markdown fences containing brackets could mis-slice (degrades to a typed `translate_error`). Fence-aware extraction can ride a prompt-hardening pass.
- `scanResult.url` (user-supplied public URL) is sent verbatim to the third-party AI provider in the prompt; query strings could carry trackers/IDs. Product flow is public-URL-only, so low risk, but consider passing origin + node counts only if privacy is tightened.

## Deferred from: code review of spec-2-2 (2026-08-16)

- Architect diffs cannot be grounded in real source: the scanner returns rule descriptions + node ids, not template/source HTML, so the model invents paths like `src/app/components/card.tsx`. Proposals are therefore plausible-but-unverified; story 2.3's renderer should label that clearly. Surfacing real source for grounding is a harvest-side product decision for a later epic.
- `MAX_PATCH_TOKENS = 2048` (and Analyst `MAX_TOKENS = 1024`) are fixed regardless of violation count; large high-severity reports truncate and degrade to a typed `translate_error`. A per-run scaled budget (e.g. `max(floor, count * per-violation)` capped) can replace the constants once `finish_reason` is inspected.
- Architect diff validation accepts add-only or delete-only unified diffs (rejects both), and does not require `---/+++`/`@@` headers — a valid add-only patch fails typed today. Deciding the exact diff contract (headers mandatory vs content-lines-only) belongs with story 2.3's renderer, which is the actual diff consumer.
- `chat()` up-front sends no `Accept` header so some providers may stream SSE; the client always `res.json()`-parses, so an SSE body degrades to a typed `translate_error`. Add `Accept: application/json` (or stream support) when streaming is actually wanted.
- Persona boilerplate is duplicated across analyst/architect (`TranslateError` catch-normalization, start/end/error log blocks, `deps` defaults). A shared `runTranslate`-style wrapper can deduplicate when a third persona or the route wiring lands.

## Deferred from: planning spec-3-1 (2026-08-16)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-1-establish-the-design-foundation-and-report-surface.md`
  summary: No Epic 3 story wires the pipeline scan→translate→report or mounts the report surface onto a route — 3.1/3.2/3.3 all build standalone components fed by an `AuditReport` prop, so the app still cannot produce or reach a live AuditReport end-to-end.
  evidence: Story 3.1 scopes the Present surface as a standalone module consistent with the 2.1–2.3 seam; producing a real AuditReport needs the translate route + provider wiring that Epics 2–3 defer. Surface mounting becomes viable once personas are wired; revisit as a dedicated wiring story before the report flow is demoable.

## Deferred from: code review of spec-3-1 (2026-08-16)

- The `AudienceToggle` restore effect is keyed on `onChange` (`apps/web/components/audience-toggle.tsx:25-30`); an unstable callback from a future consumer would re-run the storage restore on every render and could clobber a fresh user choice. Latent today (ReportSurface passes the stable `setAudience`); document the "onChange must be stable" contract or switch to a mount-once restore when the surface gets wired to a route.
- The audience storage key `darkhouse:audience` is global to the session; once more than one report surface can exist in a session, toggling one silently overrides the other's on remount. Scope the key per report/scanId at wiring time.

## Deferred from: code review of spec-3-2 (2026-08-17, loop 1)

- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-render-the-client-view-business-summary.md`
  summary: Focus drops to `<body>` after a "view fix" press because `ClientView` unmounts on the audience switch; keyboard/SR users lose their place.
  evidence: Hunted in review loop 1. The spec bans auto-scroll, not intentional focus hand-off, but the sensible focus target is the Developer View's content, which only exists in 3.3's real rows — wire a focus move when 3.3 renders the Developer View.
- source_spec: `_bmad-output/implementation-artifacts/spec-3-2-render-the-client-view-business-summary.md`
  summary: `timestamp` is optional in `contracts/audit-report.schema.json` but required in the web `AuditReport` TS type, so a null/absent timestamp could reach `formatScanDate` and render "Jan 1, 1970".
  evidence: Pre-existing schema↔type drift surfaced while tracing verification; `formatScanDate(null)` coerces to epoch and `Number.isNaN` misses it. Belongs with the deferred `@darkhouse/contracts` type-generation/schema-validation item.

## Deferred from: code review of spec-4-2 (2026-08-18, loop 1)

- source_spec: `_bmad-output/implementation-artifacts/spec-4-2-include-broken-experience-proof-in-the-export.md`
  summary: The proof ships as a `data:` URI inside the standalone HTML file, but the epic's actual outreach channel is email, where many clients strip `data:` URIs from attachments — the visual proof can silently fail to render in the target medium.
  evidence: Blind-hunter finding. In-file data-URI works for browser-opening, not for every mail client's attachment rendering; the outreach medium is a future-channel concern, not a correctness gap in the standalone file itself.