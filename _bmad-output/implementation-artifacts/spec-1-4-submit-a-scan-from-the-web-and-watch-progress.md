---
title: '1-4: Submit a scan from the web and watch progress'
type: 'feature'
created: '2026-08-15'
baseline_commit: 'd88d4912f030b3cf51ed91389ba709150557cd4a'
status: 'done'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-a11yfix-engine-2026-08-12/EXPERIENCE.md'
  - '{project-root}/_bmad-output/planning-artifacts/ux-designs/ux-a11yfix-engine-2026-08-12/DESIGN.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The web tier's Home page is the create-next-app boilerplate, so an Epic-1 user submitting a long scan gets no feedback, and the existing `POST /api/scan` seam has zero automated coverage.

**Approach:** Replace the boilerplate with a client-driven scan surface: a URL form with inline (never-toast) validation, submission to the existing `POST /api/scan` same-origin seam, and a three-stage progress stepper (Scanning → Translating → Ready) with typed failed/paused states and Retry. Add vitest + React Testing Library tooling and cover the seam plus the UI state machine.

## Boundaries & Constraints

**Always:**
- `POST /api/scan` (`apps/web/app/api/scan/route.ts`) is the only scan trigger and is not functionally changed; the form POSTs it with `{ url }` JSON. Loopback/private https URLs stay scannable (dev carve-out; SSRF guard deferred).
- Validation is client-side, inline next to the input, never a toast, and never starts the pipeline on failure. A valid submit starts immediately.
- All three named stages always render: Scanning → Translating → Ready. In 1.4 Translating is a no-op pass-through to Ready after a successful envelope; the stage order/name contract is fixed for Epic 2.
- Three states are visually distinct: `failed` (Retry + human cause hint), `paused` (copy exactly "Translation is waiting on a free-tier limit — retrying."), and `ready`. Cause copy is human-language from the error envelope, never a raw `code`.
- No parent-side auto-repeat, celebration animation, or toast. A11y floor per EXPERIENCE.md: labeled focusable controls, visible focus ring, keyboard-operable, instant under Reduce Motion, status never color-only.
- Work stays on branch `feat/epic-1-scanning`; tests run via `pnpm --filter @a11yfix/web test`.

**Ask First:**
- None known; the four product decisions for 1.4 (Translating pass-through, vitest+RTL, minimal ready confirmation, loopback dev carve-out) are already settled.

**Never:**
- No AI/persona calls, no patch application, no storage/persistence — 1.4 holds the ScanResult in component state only (translate = Epic 2, storage = later epic).
- Do not modify scanner code or `contracts/*.schema.json`.
- Do not place client components inside `apps/web/app/` outside `page.tsx`/`route.ts` (would create routes); use `apps/web/components/` and `apps/web/lib/`.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid `https://` URL submitted | POST to `/api/scan`; Scanning → Translating (pass-through) → Ready; shows URL, violation count, vitals (LCP/CLS), timestamp | N/A |
| ERROR_CASE | Malformed / empty / non-https URL on submit | Inline error beside the input; no POST, no pipeline start | N/A |
| ERROR_CASE | Scanner returns 502/400/500 envelope (`unreachable`/`timeout`/`invalid_url`) | `failed` state: Retry button + human-language cause hint from envelope | Retry re-submits the same URL |
| ERROR_CASE | Scanner returns 503 `busy` | `paused` state, distinct surface, copy "Translation is waiting on a free-tier limit — retrying." | Retry available; not a hard failure |
| EDGE_CASE | First load, no submission yet | Home shows exactly "No scans yet — paste a URL to run your first audit." | N/A |
| EDGE_CASE | `https://127.0.0.1:8443` (dev loopback) | Accepted; pipeline starts | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/app/api/scan/route.ts` -- existing seam: parses `{ url }`, proxies to `SCANNER_URL` (default `http://127.0.0.1:8000`), passes the scanner's status+body through untouched (200 ScanResult; 400/422/502/503 ADR-8 envelopes). Exports `POST` directly — importable in vitest. No functional change.
- `contracts/scan-result.schema.json` -- success envelope shape: `schemaVersion, scanId, url, violations[], vitals{lcp,inp,cls}, timestamp`. TS types for it in 1.4 are hand-written, not generated.
- `apps/web/app/page.tsx` -- replace create-next-app boilerplate with a thin Server page (empty-state copy + `<ScanForm/>`). Server Component (must remain compatible with `LayoutProps<"/">`).
- `apps/web/components/scan-form.tsx` -- NEW `'use client'`: input, inline validation, submit → `POST /api/scan`, stepper, failed/paused/ready surfaces.
- `apps/web/components/progress-stepper.tsx` -- NEW presentational stepper (`aria-current` on active stage, three named steps, `prefers-reduced-motion` respected).
- `apps/web/lib/validate-scan-url.ts` -- NEW pure `validateScanUrl(url): string | null` (mirror scanner rules: trim, https-only, parseable netloc; loopback allowed).
- `apps/web/lib/scan.ts` -- NEW typed wrapper: `submitScan(url)` returns discriminated `{ok:true, data}` | `{ok:false, code, message, status}` from `POST /api/scan`.
- `apps/web/globals.css` -- extend `@theme` with the minimal DESIGN.md tokens 1.4 needs (indigo primary, error, warning, success, border/outline). Full token foundation is story 3.1.
- `apps/web/package.json` -- add `test: "vitest run"` script + devDeps: `vitest`, `@vitejs/plugin-react`, `jsdom`, `@testing-library/react`, `@testing-library/dom`, `@testing-library/user-event`, `vite-tsconfig-paths`.
- `apps/web/vitest.config.mts` -- NEW: `plugins: [tsconfigPaths(), react()]`, `test.environment: 'jsdom'`, include `**/*.test.{ts,tsx}`.
- `apps/web/tests/scan-form.test.tsx`, `apps/web/tests/validate-scan-url.test.ts`, `apps/web/tests/route.test.ts` -- NEW. Route test uses a `// @vitest-environment node` docblock and mocks `global.fetch` against the real exported `POST` (node env keeps `AbortSignal.timeout`/`Request` globals stable).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/package.json` -- add `test` script and the 7 devDeps, then `pnpm install` -- test tooling.
- [x] `apps/web/vitest.config.mts` -- vitest + jsdom + tsconfig-paths + react plugin -- runnable RTL tests.
- [x] `apps/web/lib/validate-scan-url.ts` -- pure https-only validator (loopback allowed) -- testable inline validation.
- [x] `apps/web/lib/scan.ts` -- typed `submitScan` against `POST /api/scan` -- single state-machine surface.
- [x] `apps/web/app/page.tsx` -- replace boilerplate with empty-state + `<ScanForm/>` -- the Home surface.
- [x] `apps/web/components/scan-form.tsx` -- `'use client'` form, inline validation, stage machine (idle→scanning→translating→ready|failed|paused), Retry -- the AC behavior.
- [x] `apps/web/components/progress-stepper.tsx` -- three named steps with `aria-current` -- accessible stage contract.
- [x] `apps/web/globals.css` -- add the minimal 1.4 DESIGN tokens to `@theme` -- statuses not color-only.
- [x] `apps/web/tests/validate-scan-url.test.ts` -- unit cases from the I/O matrix -- valid/https-only/loopback/empty.
- [x] `apps/web/tests/scan-form.test.tsx` -- RTL: empty state renders; invalid submit shows inline error + no POST; success shows Stepper→Ready with counts; 502 → failed+Retry; 503 → paused copy; Retry re-submits -- ACs 1–3.
- [x] `apps/web/tests/route.test.ts` -- node env, mocked `global.fetch`: happy passthrough; invalid JSON/blank url → 400; fetch throw → 502; scanner 502/503 envelope passes status+body through -- closes the deferred seam-cover item.
- [x] Self-review against READY FOR DEVELOPMENT standard.

**Acceptance Criteria:**
- Given the Home surface, when I submit a URL, then the scan validates inline (never a toast), starts immediately, and shows the named stages Scanning → Translating → Ready.
- Given a failing stage, when the scan returns an unrecoverable error, then a failed state renders with a Retry action and a human cause hint, distinct from a rate-limit pause that shows "Translation is waiting on a free-tier limit — retrying.".
- Given no scans yet, when the Home page loads, then the empty state reads "No scans yet — paste a URL to run your first audit.".

## Spec Change Log

- **2026-08-15 (review loop 1):** Four-layer code review (blind-hunter, edge-case-hunter, verification-gap, acceptance-auditor) merged. Patches applied: `isScanResult` now requires `vitals.lcp/inp/cls` as `number|null` so a near-valid 200 envelope can no longer paint "NaN ms" (two new `scan.test.ts` cases); the failed state surfaces the envelope's own human `message` with the static hint table as empty-message fallback (three test pins); `route.test.ts` pins `SCANNER_URL` via `vi.stubEnv` + fresh module import so an ambient env override cannot flake the seam assertions; the URL input is marked `required`/`aria-required`; completed `ProgressStepper` steps announce as "completed" and the component gained a dedicated test suite; the failed panel uses `role="alert"` so action failures interrupt; the unused `@testing-library/user-event` devDependency is removed. Dismissed with evidence: `@/` alias imports (resolved via `tsconfig` paths + `vite-tsconfig-paths`), route.ts absence from the diff (seam unchanged by design), IPv6 eligibility (scanner rejects the same), translating-stage visibility under failures, copy-constant test duplication (frozen-copy contract pins), deterministic fake-timer helper. Deferred entries logged in `deferred-work.md` (client timeout/cancel, IPv6, IDN host mismatch, design-token contrast, paused auto-resume, report details/history). KEEP: any single-page passthrough, 400ms translating buffer, 130s server-bounded scan.

## Design Notes

- **State machine:** `idle → scanning → [failed | paused]` from the envelope; `scanning → translating → ready` immediately after a 200. `failed`/`paused` both keep the submitted URL so Retry just re-runs `submitScan`.
- **Envelope mapping:** HTTP 200 → ready; 503 → paused; anything else non-2xx (400/422/500) → failed. Human copy derived from envelope `code` (e.g. `unreachable`/`timeout` → "We couldn't reach that site — it may be down, or the network is slow."); never render the raw code as primary text.
- **Route-test env:** `route.ts` relies on global `Request`/`AbortSignal.timeout`; run its test under node (`// @vitest-environment node`) while UI tests stay in jsdom.

## Verification

**Commands:**
- `pnpm install` -- expected: lockfile updates, no errors.
- `pnpm --filter @a11yfix/web test` -- expected: all vitest suites pass.
- `pnpm --filter @a11yfix/web lint` -- expected: clean ESLint.
- `pnpm --filter @a11yfix/web build` -- expected: typecheck + build succeed (Next 16 removed `next lint`).

**Manual checks (if no CLI):**
- `pnpm dev` with `uv run uvicorn services.scanner.app.main:app` running: submit a live URL → stepper Scanning → Ready with counts; submit an unreachable URL → failed + Retry + hint; open Home first visit → exact empty-state copy.