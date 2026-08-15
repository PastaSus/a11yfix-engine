---
title: '1-3: Capture Core Web Vitals in the audit'
type: 'feature'
created: '2026-08-15'
status: 'done'
baseline_commit: '3fbfbad3c5fd6917e231ffb84e813d9ef51e62f5'
review_loop_iteration: 1
review_loop_iteration: 0
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** `build_scan_result` ships `vitals: { lcp, inp, cls }` as hardcoded nulls (FR-3 unimplemented), and NFR-1's bounded headless-instance budget (deferred from 1.1's review) is unenforced — every `/scan` launches unbounded Chromium.

**Approach:** Measure LCP and CLS from the same page load via a small init script registered before navigation (buffered PerformanceObservers); INP stays null (no user interaction in an automated scan). Bound concurrent launches with an `asyncio.Semaphore` that queues, then returns a typed `busy` error if no slot frees.

## Boundaries & Constraints

**Always:**

- Vitals measured from the **same page load** as axe-core violations (`add_init_script` before `goto`, read back after `axe.run()`).
- `contracts/scan-result.schema.json` **unchanged/read-only** — `lcp`/`cls` are already `["number","null"]`, `inp` already nullable.
- Every wait bounded (incl. new slot wait) — scan completes or returns a typed error, never hangs. Errors keep ADR-8 `{ code, message, stage }`; busy reuses `HarvestError` with `code="busy"`/`stage="harvest"` and **HTTP 503** (capacity condition, distinct from gateway failure — decision confirmed by human).
- INP always null: no synthetic interactions in an automated scan (decision confirmed). Vitals probe is a ~10-line inline init script; no vendored `web-vitals` lib.

**Ask First:**

- Concurrency defaults: propose `MAX_CONCURRENT_SCANS = 3`, `SCAN_SLOT_TIMEOUT_MS = 30_000` (queue; exceed → typed `busy`). Confirm before locking.

**Never:**

- No synthetic click/keypress to manufacture INP.
- No change to the wire contract, `contracts/`, or the web tier.
- No CPU/memory introspection for limits — slotting only.
- No auto-apply/auto-fix of violations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Fixture page with rendered content | `vitals.lcp`/`cls` are numbers from the same load; `inp` null; envelope passes schema validation | N/A |
| HAPPY_PATH | ≤ `MAX_CONCURRENT_SCANS` concurrent scans | All proceed; no queuing | N/A |
| ERROR_CASE | > bound concurrent scans | Excess requests queue | No slot within `SCAN_SLOT_TIMEOUT_MS` → `{ code: "busy", stage: "harvest" }`, HTTP 503 |
| ERROR_CASE | Observers never fire (error/blob page, no LCP) | `lcp` is null; `cls` is null only when the probe never ran — a measured clean page (observers ran, zero shifts) reports `cls = 0.0` | N/A (nulls/0.0 legal) |
| EDGE_CASE | Existing 1.1 static / 1.2 SPA scans | Behavior unchanged plus non-null `lcp`/`cls` where measurable | N/A |

</frozen-after-approval>

## Code Map

- `services/scanner/app/harvest.py:24-29` -- constants block; add `MAX_CONCURRENT_SCANS`, `SCAN_SLOT_TIMEOUT_MS`, module-level `asyncio.Semaphore`.
- `services/scanner/app/harvest.py:73-82` -- `build_scan_result`: replace hardcoded null `vitals` with a passed-in dict (default all-null keeps old callers/tests green).
- `services/scanner/app/harvest.py:135-184` -- `run_scan`: `add_init_script(VITALS_INIT_SCRIPT)` after `new_page()`/before `goto`; read `window.__a11yfixVitals` after `axe.run()`; wrap `async with async_playwright()` in slot acquire/release. Acquire's own `wait_for` timeout → `HarvestError(code="busy")`; verify it passes through both the `except (PlaywrightError, PlaywrightTimeoutError)` and `run_scan_with_timeout`'s `except asyncio.TimeoutError` untouched.
- `services/scanner/app/harvest.py:187-195` -- `run_scan_with_timeout`: confirm busy passes through; otherwise unchanged.
- `services/scanner/app/errors.py:40-45` -- `HarvestError` already accepts `code=` override; no change.
- `services/scanner/tests/conftest.py` -- existing `spa_fixture_server` serves `fixtures/` on an ephemeral port; reuse.
- `services/scanner/tests/test_spa_render.py` -- `_chromium_available()` skip + `monkeypatch` budget-shrink patterns to mirror.
- `services/scanner/tests/test_harvest.py` -- existing `build_scan_result`/schema tests stay green (no `vitals` arg → nulls).

## Tasks & Acceptance

**Execution:**

- [x] `services/scanner/app/harvest.py` -- add `VITALS_INIT_SCRIPT` (inline JS: `largest-contentful-paint` + `layout-shift` observers, `buffered: true`, write `window.__a11yfixVitals = { lcp, cls, _cls }`) and pure `collect_vitals(page)` → `{ lcp: float|None, inp: None, cls: float|None }`.
- [x] `services/scanner/app/harvest.py` -- add `MAX_CONCURRENT_SCANS`/`SCAN_SLOT_TIMEOUT_MS`, module-level `asyncio.Semaphore`, `acquire_scan_slot()` (own `wait_for` timeout → `HarvestError(code="busy")`); release in `finally`.
- [x] `services/scanner/app/harvest.py` -- wire `run_scan`: init script before `goto`, `collect_vitals` after `axe.run()` → `build_scan_result(url, scan_id, violations, vitals)`.
- [x] `services/scanner/tests/fixtures/vitals.html` -- page with a guaranteed LCP element (large text block) and a post-load layout shift so CLS is nonzero; served by existing fixture server.
- [x] `services/scanner/tests/test_vitals.py` -- chromium-gated: scan `vitals.html` → `lcp` non-null number, `cls` number, `inp` `None`, envelope passes `validate_envelope`; no-browser unit test for `collect_vitals` normalization.
- [x] `services/scanner/tests/test_harvest.py` -- slot-bound unit tests: full semaphore + short timeout → `HarvestError(code="busy")`; released slot → acquire succeeds.
- [x] Self-review against READY FOR DEVELOPMENT standard.

**Acceptance Criteria:**

- Given a completed scan of a page that renders content, when the ScanResult is assembled, then the `vitals` block is present with `lcp` and `cls` as numbers from the same page load, `inp` null, and the envelope validates against `contracts/scan-result.schema.json`.
- Given concurrent `/scan` requests exceeding `MAX_CONCURRENT_SCANS`, when slots stay exhausted past `SCAN_SLOT_TIMEOUT_MS`, then a typed `{ code: "busy", stage: "harvest" }` (HTTP 503) is returned and no request hangs.

## Spec Change Log

## Design Notes

- **Observers not `getEntriesByType` at the end:** CLS is only measurable via a `layout-shift` observer registered before the shifts happen; `add_init_script` is the only reliable pre-page hook. LCP uses `buffered: true` so late reads still see earlier entries.
- **Queue + bound, not reject or unlimited:** rejecting immediately would break story 1.4's "watch progress" UX; an unbounded queue defeats the resource bound. A short slot wait turns saturation into a cheap typed error.
- **Golden normalize example:** `window.__a11yfixVitals = { lcp: 812.5, cls: 0.034 }` → `{ "lcp": 812.5, "inp": None, "cls": 0.034 }`. A measured clean page (no shifts) → `cls: 0.0` (a real measurement, not null). No LCP element → `lcp: None`. Probe never ran / blank page → `{ "lcp": None, "inp": None, "cls": None }`. Epic 3's Developer View renders nulls as "—" and 0.00 as a clean score.
- **`cls` sentinel, not a mirror field:** the probe seeds `cls: null`; a `layout-shift` firing accumulates it from 0 so measured-zero (`0.0`) stays distinct from unmeasured (`null`, no observers fired).

## Spec Change Log

- **2026-08-15 (review loop 1):** Human-renegotiated 2 frozen semantics surfaced by code review. (1) `busy` HTTP status changed `502` → `503` — saturation is a capacity condition, not a gateway failure; ADR-8 envelope unchanged, only the status code. (2) `cls` semantics: measured-clean reports `cls: 0.0`, only unmeasured (probe never ran) reports `cls: null`; mirror-field dropped for an explicit null sentinel. Amended in Boundaries, I/O matrix, AC, Design Notes. KEEP: the `asyncio.Semaphore` slot-only bound, `code="busy"` envelope reusing `HarvestError`, INP-null decision.
- **2026-08-15 (review loop 1 findings applied):** 6 patch findings from the 3-layer review applied and verified (59 tests pass). `_vital_number` rejects NaN/Infinity (prevents `allow_nan=False` 500); `cls` null-sentinel replaces the `_cls` mirror; `busy` raises with `status_code=503` via `HarvestError.__init__` override; `slot_acquired` guard prevents release without acquisition; vitals read is best-effort (probe-read failure → null vitals, not a false "unreachable"); HTTP-seam busy test added. 9 defers logged to `deferred-work.md` (vitals fidelity, per-process bound, env-config, `_chromium_available` dedup, live no-vitals fixture, etc.). KEEP: observer-based probe remains (verified empirically that `getEntriesByType` is unavailable at read time).

## Verification

**Commands:**

- `uv run python -m pytest services/scanner/tests/ -v` -- expected: all pass, including the new vitals test when chromium is installed (skipped otherwise, matching existing live-test convention).
- `uv run python -c "from services.scanner.app.harvest import run_scan, collect_vitals, acquire_scan_slot; print('import OK')"` -- expected: import OK.

**Manual checks (if no CLI):**

- Vitals fixture scan → `vitals.lcp` non-null (≈ big block render time), `vitals.cls` > 0.
- >3 concurrent `/scan` with a 1s slot timeout → typed `busy` body for waiters; scans never hang.

## Suggested Review Order

**Vitals probe and envelope wiring**

- Probe registers buffered LCP + CLS observers before any page script runs — the only reliable hook for CLS.
  [`harvest.py:38`](../../services/scanner/app/harvest.py#L38)

- `collect_vitals` normalizes probe output; null CLS sentinel keeps measured-clean (0.0) distinct from unmeasured.
  [`harvest.py:105`](../../services/scanner/app/harvest.py#L105)

- Vitals read back best-effort after `axe.run()`; build_scan_result merges them into the same-load envelope.
  [`harvest.py:283`](../../services/scanner/app/harvest.py#L283)

**Concurrency slot bound**

- Slot acquired before any browser launch; busy raises a typed 503 on saturation, never hangs.
  [`harvest.py:219`](../../services/scanner/app/harvest.py#L219)

- `slot_acquired` guard means only a successful acquisition is ever released; always in the outermost finally.
  [`harvest.py:243`](../../services/scanner/app/harvest.py#L243)

- `HarvestError` gained a per-instance `status_code` override so busy surfaces 503 while other harvest errors stay 502.
  [`errors.py:40`](../../services/scanner/app/errors.py#L40)

**Tests**

- Vitals integration + `collect_vitals` unit suite: measured-clean 0.0, unmeasured null, NaN/Infinity rejection.
  [`test_vitals.py:42`](../../services/scanner/tests/test_vitals.py#L42)

- Busy cross-verifies the HTTP seam end-to-end: saturated slot → 503 `{code:busy}`.
  [`test_main.py:75`](../../services/scanner/tests/test_main.py#L75)

- Slot release after success and after typed timeout, on the real module semaphore.
  [`test_spa_render.py`](../../services/scanner/tests/test_spa_render.py)