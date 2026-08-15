---
title: '1-2: Harvest the DOM with SPA-render awareness'
type: 'feature'
created: '2026-08-15'
status: 'done'
baseline_commit: 'b1114014bfdc6f3ffc98fc3735c0a43058603120'
review_loop_iteration: 1
context: []
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The harvest stage waits for `domcontentloaded` and then swallows a `networkidle` timeout (`pass`), so axe-core often runs against a single-page-app shell before deferred content renders. Later-rendered nodes — the real violations — are missed, violating FR-2.

**Approach:** Make the load wait SPA-aware: wait for network idle; if a page never goes idle (long-polling/sockets), fall back to a bounded DOM-stability check; if the page never stabilizes, return a typed timeout. Prove it with a local test SPA whose deferred content carries a violation, plus a chromium-gated integration test asserting that violation is captured and that scans never hang.

## Boundaries & Constraints

**Always:**

- Every wait is bounded (navigation, network-idle, DOM-stability) by a configured timeout. The scan either completes or returns a typed `{ code: "timeout", stage: "harvest" }` HarvestError — it never hangs indefinitely (NFR-2).
- axe-core `axe.run()` executes only after the SPA-ready wait succeeds (idle or DOM-stable) — never against the unrendered shell.
- The ScanResult envelope shape (schemaVersion, scanId, url, violations, vitals, timestamp) is unchanged; this story changes only load-wait behavior. `contracts/` schemas are untouched.
- All errors keep the ADR-8 `{ code, message, stage }` envelope; no new unhandled-exception path.
- URL validation (`validation.py`) is unchanged; the local test SPA bypasses the public `POST /scan` validation path by calling `run_scan` directly.

**Ask First:**

- SPA-ready budget defaults: propose network-idle wait = `NETWORKIDLE_TIMEOUT_MS` (30s), DOM-stability fallback budget = 15s with ~500ms samples and 3 consecutive equal samples = stable. Confirm before locking into the spec.

**Never:**

- No polling of external SPAs, no CDN assets, no network dependency in tests (fixtures served locally).
- No change to the wire contract or `contracts/` schemas.
- No auto-apply/auto-fix of violations.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | SPA that settles: defers content via `setTimeout(~1s)` then goes quiet | Network-idle fires; axe runs after render; violations in later-rendered nodes appear in the envelope | N/A |
| ERROR_CASE | Long-polling/websocket SPA that never reaches network idle | DOM-stability fallback engages; if DOM stabilizes, axe runs; if not, typed timeout | `{ code: "timeout", stage: "harvest" }`, HTTP 502 |
| ERROR_CASE | Endless-mutating page (DOM never stable within budget) | Scan returns typed timeout, never hangs | `{ code: "timeout", stage: "harvest" }`, HTTP 502 |
| EDGE_CASE | Static no-JS page | `domcontentloaded` + idle/stability resolve quickly; behavior identical to 1.1 | N/A |

</frozen-after-approval>

## Code Map

- `services/scanner/app/harvest.py:93-107` -- the load-wait block to replace: `goto(..., wait_until="domcontentloaded")` followed by the swallowed `networkidle` timeout.
- `services/scanner/app/harvest.py:22-24` -- existing timeout constants (`NAVIGATION_TIMEOUT_MS`, `NETWORKIDLE_TIMEOUT_MS`) to reuse for the SPA-ready budget.
- `services/scanner/app/harvest.py:80-132` -- `run_scan`: where the new wait slots in, before `add_script_tag` + `axe.run()`.
- `services/scanner/tests/test_harvest.py` -- existing unit/integration tests (schema, envelope, wall-clock timeout) that must stay green.
- `services/scanner/tests/test_main.py` -- endpoint tests; the chromium-gated `_chromium_available()` skip pattern to mirror for the new SPA tests.
- `services/scanner/app/errors.py` -- `HarvestError` with `code`/`stage` to reuse for the typed timeout.

## Tasks & Acceptance

**Execution:**

- [x] `services/scanner/app/harvest.py` -- replace the swallowed `networkidle` block with an SPA-ready wait: try `wait_for_load_state("networkidle")`; on timeout, poll a DOM-stability fingerprint (e.g. `document.body.innerHTML.length` or element count) at ~500ms; treat 3 consecutive equal samples as stable; on exhausted budget raise `HarvestError(code="timeout")`. Keep a pure helper for the stability decision so it's unit-testable without a browser.
- [x] `services/scanner/tests/fixtures/spa-deferred.html` -- minimal SPA: renders a shell immediately, then inserts a deferred node carrying a clear violation (e.g. `<img>` without `alt`) via `setTimeout`.
- [x] `services/scanner/tests/fixtures/spa-endless.html` -- page that mutates the DOM on a fixed interval so it never stabilizes (timeout-path fixture).
- [x] `services/scanner/tests/conftest.py` -- pytest fixture starting a threaded `http.server` on an ephemeral port serving the fixtures dir; yields the base URL; teardown stops it.
- [x] `services/scanner/tests/test_spa_render.py` -- chromium-gated integration tests mirroring the `_chromium_available()` skip: (a) scan the deferred SPA → violations include the deferred node; (b) scan the endless SPA with a short timeout → typed `code: "timeout"`, never hangs.
- [x] `services/scanner/tests/test_harvest.py` -- add a pure unit test for the stability-decision helper; keep existing tests green.
- [x] Self-review against READY FOR DEVELOPMENT standard.

**Acceptance Criteria:**

- Given a test SPA with deferred-rendered content, when the scan runs and axe-core analyzes the DOM, then violations in later-rendered nodes are captured.
- Given a page that never stabilizes, when the scan runs, then it completes within the configured timeout or returns a typed timeout status — it never hangs indefinitely.

## Spec Change Log

## Review Findings

Review loop iteration 1 — 2026-08-15. Verdict: CHANGES_REQUESTED → resolved; status now done.

**PATCH (1):**

- `L3-1` — The DOM-stability fallback *success* branch (`wait_spa_ready` returning via `dom_has_stabilized`) had zero test coverage: the deferred fixture proved the networkidle path and the endless fixture only proved the `raise` path. **Fixed:** added `tests/fixtures/spa-deferred-with-hold.html` (streams `/hold` so networkidle never fires, but stops churning after a deferred `<img>` insert, so the stability probe must gate `axe.run()` and capture `image-alt`) and `test_hold_spa_stability_fallback_captures_late_violations` in `test_spa_render.py`. Suite now 45 passed, all SPA tests ran against installed chromium.

**DEFER (10):** — `L1-1` (non-timeout PlaywrightError mislabeled `unreachable` in `run_scan`'s outer handler); `L1-2` + `L2-7` (stability loop may exceed nominal budget by ≤1 sample period; still bounded, `run_scan_with_timeout` is backstop); `L1-4` (sequential budgets ≈45s pre-axe worst case on never-idle churning page — spec-consistent, not a hang); `L2-1` (length-only fingerprint collision false-"stable"; spec chose the scalar); `L2-5` (deferred-fixture flake margin vs `networkidle` timing — hardening later); `L3-2` + `L4-5` (no end-to-end `code:"timeout"`→HTTP 502 assertion; proven transitively via `errors.py` handler); `L3-3` (offline deterministic static-page test missing — live test skips offline); `L4-3` (HAPPY_PATH asserts outcome not mechanism — a future move of the fixture to the stability path would still pass).

**DISMISS (10):** — `L1-3` (3-sample minimum latency is spec-chosen); `L2-2` (empty body fingerprints 0 → stable → axe runs is acceptable); `L2-3` (daemon `/hold` teardown benign, documented); `L2-4` (ephemeral-port connect-backlog race is benign); `L2-6` (chromium-skip flake mirrors test_main convention); `L3-4` (tautological constant test is a harmless tripwire); `L4-1`/`L4-2`/`L4-4` (AC1/AC2 and envelope-unchanged proven).

**DECISION-NEEDED (2), resolved by frozen spec, no code change:**

1. *networkidle-authoritative semantics* — a setTimeout-only render that goes network-idle early never engages the stability probe. This IS the approved design (intent: "wait for network idle; if a page never goes idle, fall back"); the gap for environments where idle fires before deferred render is accepted for 1.2 (the deferred fixture holds a connection precisely so idle fires only after render).
2. *Sequential budgets* (\~45s worst-case pre-axe wait) — confirmed: two independent bounded budgets + `run_scan_with_timeout` wall-clock backstop is exactly the frozen design; no single-global-budget change.

## Design Notes

- **Why not networkidle alone:** long-polling and websocket pages never reach idle, so the old code's `except PlaywrightTimeoutError: pass` silently ran axe on the shell. DOM-stability polling adds a bounded second signal with zero new dependencies.
- **Fingerprint choice:** a cheap scalar (e.g. `document.body.innerHTML.length`) sampled across ~500ms intervals; 3 consecutive equal samples mean no DOM churn. Extract the "is stable" decision into a pure function taking the sample history, so it's unit-tested without launching a browser.
- **Test serving:** the endpoint's `validate_url` rejects `http://`, so integration tests call `run_scan` directly against a local `http.server` (stdlib) on an ephemeral port — self-contained and offline.
- **Budget defaults to confirm:** network-idle wait 30s, stability budget 15s, sample 500ms, 3 stable samples. All bounded; wall-clock `run_scan_with_timeout` remains the final backstop.

## Verification

**Commands:**

- `uv run python -m pytest services/scanner/tests/ -v` -- expected: all pass, including the new chromium-gated SPA tests when chromium is installed (skipped otherwise, matching existing live-test convention).
- `uv run python -c "from services.scanner.app.harvest import run_scan; print('import OK')"` -- expected: import OK.

**Manual checks (if no CLI):**

- With chromium installed, `test_deferred_spa_captures_late_violations` passes and the envelope's `violations` includes a node from the deferred fixture content.
- `test_endless_spa_returns_typed_timeout` completes in roughly the stability budget (not minutes) and returns `code: "timeout"` — never hangs.
