---

title: '4-2: Include broken-experience proof in the export'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: 'dd0742f8f356b058ca6486a0278aaafb2386afca'
review_loop_iteration: 1
context:

- '\_bmad-output/implementation-artifacts/epic-4-context.md'
- '\_bmad-output/implementation-artifacts/spec-4-1-export-the-audit-report-as-a-diagnostic-report.md'
- '\_bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/EXPERIENCE.md'

---

## Intent

**Problem:** The 4-1 Diagnostic Report export contains counts, priorities, and impacts — the data of a broken experience — but no visual proof. FR-12 and the outreach goal fail: "showing beats telling" requires the export to carry a screenshot of at least one high-priority broken experience, and no capture source exists anywhere in the pipeline (the scanner never calls `page.screenshot`, neither contracts schema has a proof field, and the web `AuditReport` type has none).

**Approach:** End-to-end proof capture. The scanner captures a full-page PNG screenshot when the page has at least one high-severity (critical or serious) violation, base64-encodes it into a `proof` block on the `ScanResult` envelope, the web tier carries it through into `AuditReport`, and `renderReportHtml` embeds it as an `<img>` data-URI in a new proof section of the exported HTML. Capture is best-effort — a screenshot failure degrades to `proof: null`, never fails the scan (mirrors the vitals pattern). The contract shape (`mimeType` + `dataBase64`) is format-agnostic so a future switch from full-page to cropped screenshots is scanner-only.

## Boundaries & Constraints

**Always:**

- The scanner emits `proof` as `{ mimeType: "image/png", dataBase64: <base64> }` or `null` — capture happens in `run_scan` after axe/vitals are read, while the page is still open, full-page PNG. Schema declares `proof` as nullable object; a high-severity scan with a failed capture yields `null`, never a scan failure and never an exception.
- The `proof` block flows ScanResult → `AuditReport` verbatim across the HTTP boundary and the `translateAnalyst` assembly; both `contracts/*.schema.json` files gain the same optional nullable `proof` property (the schemas are canonical — TS mirror types and the Python envelope are updated to match, never diverged).
- The export embeds proof only when it is a non-empty object: `<section class="card proof">` with an `<img alt="Broken experience on {hostname}">` sourced from `data:{mimeType};base64,{dataBase64}`. A `null`/absent proof — zero high-severity violations, or failed capture — omits the section entirely; the export still succeeds (FR-12 AC 2).
- The proof section uses the Client View register: no rule IDs, no Developer vocabulary; the alt text and any caption are plain business language consistent with 4-1's output.
- "No proof is ever empty": if the proof section renders, its `dataBase64` is non-empty by construction and the image is decodable in any modern browser. Never emit a placeholder image.
- Bounded-resource invariants hold: full-page capture is a single bounded `page.screenshot` call inside the existing scan slot and wall-clock timeout — no extra browser, no retry loop.

**Ask First:**

- Whether full-page (default) vs cropped-to-first-node is the shipped proof format. The schema/export tolerate either; a change is scanner-only. (PRD OQ-3 flags this for UX validation.)

**Never:**

- No proof field that is `required` at the schema level — the field stays optional/nullable so zero-severity scans and pre-proof consumers keep validating.
- No new npm or PyPI dependencies; no external screenshot/PDF service; no PDF; no auto-applied patches in the export (NFR-6 holds for files as for UI).
- No Developer-View vocabulary in the proof section or captions.
- Never fabricate a screenshot when capture fails or when the page has no high-severity violation.

## I/O & Edge-Case Matrix

| Scenario          | Input / State                                                  | Expected Output / Behavior                                                                                                                                                  | Error Handling                               |
| ----------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| HAPPY_PATH        | Scan with ≥1 critical/serious violation; screenshot succeeds   | ScanResult carries `proof: { mimeType: "image/png", dataBase64: "<base64>" }`; export renders a proof card with a decodable `<img>` data-URI and business-language alt text | N/A                                          |
| CAPTURE_FAILURE   | High-severity violations but `page.screenshot` throws          | `proof` is `null`; scan succeeds; export omits the proof section (data is still exported)                                                                                   | capture wrapped best-effort, never re-raised |
| ALL_PASS          | Zero high-severity violations                                  | `proof` is `null`; export omits the proof section and still succeeds                                                                                                        | N/A                                          |
| SCHEMA_GATE       | A hypothetical envelope with a malformed `proof` (wrong shape) | Contract validator rejects it with the existing `schema_error` typed failure (not silent)                                                                                   | Draft7 `additionalProperties: false` + shape |
| EXPORT_NO_PROOF   | Any report whose `proof` is null/absent                        | `renderReportHtml` output contains no proof section; all 4-1 sections intact                                                                                                | N/A                                          |
| EXPORT_WITH_PROOF | Report with `proof` populated                                  | Exported HTML contains `<section class="card proof">` with `<img src="data:image/png;base64,…">` and alt text; file opens standalone                                        | N/A                                          |

## Code Map

- `contracts/scan-result.schema.json` — add optional nullable `proof` property (`{ mimeType: const "image/png", dataBase64: string minLength 8 }`, `additionalProperties: false`); keep `schemaVersion` const 1.0.0 and existing `required` list untouched.
- `contracts/audit-report.schema.json` — same `proof` property, same constraints; canonical schema is the single source of truth.
- `services/scanner/app/harvest.py` — `build_scan_result(url, scan_id, violations, vitals, proof=None)` gains the param and always sets the `"proof"` key (`None` or object). New pure helpers: `has_high_severity(violations) -> bool` (impact in `{"critical","serious"}`) and `build_proof_block(png_bytes) -> dict` (`mimeType`/`dataBase64` via `base64.b64encode`). In `run_scan` (around line 285, after the vitals read), when `has_high_severity` capture `await page.screenshot(full_page=True)` into `build_proof_block`, wrapped best-effort (`except (PlaywrightError, PlaywrightTimeoutError): proof = None`).
- `services/scanner/app/main.py` — no change required; the cached validator reads the contracts file at startup.
- `services/scanner/tests/test_harvest.py` — extend `test_build_scan_result_envelope` and the schema-conformance test to cover `proof: null` and a populated proof block; new pure tests for `has_high_severity` and `build_proof_block` (no browser needed).
- `apps/web/lib/scan.ts` — add `export type Proof = { mimeType: string; dataBase64: string }`; `ScanResult` gains optional `proof?: Proof | null`. `isScanResult` unchanged (optional field, permissive guard).
- `apps/web/lib/translate/client.ts` — export `Proof` (or import from `@/lib/scan`); `AuditReport` gains `proof?: Proof | null`.
- `apps/web/lib/translate/analyst.ts` — `buildAuditReport` (line 117) carries `proof: scanResult.proof ?? null`.
- `apps/web/lib/export.ts` — `EMBEDDED_CSS` adds `.proof img { max-width: 100%; border-radius: …; border: … }`; `renderReportHtml` appends a proof `<section>` (business alt text from hostname) when the report `proof` is a non-empty object, omits otherwise. Escape nothing extra: `dataBase64` is base64 (safe charset) and mimeType is a schema-constrained constant.
- `apps/web/tests/fixtures.ts` — `makeReport(violations, impacts, patches, proof = null)` gains the optional param and stamps it into the fixture.
- `apps/web/tests/export.test.ts` — add: proof present ⇒ data-URI `<img>` + proof section in output; proof null/absent ⇒ no proof section and 4-1 sections intact; no-Developer-vocabulary still holds with a proof present.
- `apps/web/tests/report-surface.test.tsx` — one addition: with a proof-bearing report, the downloaded blob HTML contains the proof section; no fetch during export with proof present.

## Tasks & Acceptance

**Execution:**

- [x] `contracts/scan-result.schema.json` and `contracts/audit-report.schema.json` -- add optional nullable `proof` property -- canonical contract, enables validator gate without breaking existing envelopes.
- [x] `services/scanner/app/harvest.py` -- `build_scan_result` proof param, `has_high_severity`, `build_proof_block`, and best-effort `page.screenshot(full_page=True)` capture in `run_scan` -- FR-12 capture source, NFR-2 (best-effort, bounded).
- [x] `apps/web/lib/scan.ts` + `apps/web/lib/translate/client.ts` + `apps/web/lib/translate/analyst.ts` -- `Proof` type, optional `proof` on `ScanResult`/`AuditReport`, threaded through `buildAuditReport` -- carries the field end-to-end without schema divergence.
- [x] `apps/web/lib/export.ts` -- proof section in `renderReportHtml` + `.proof` CSS when proof is non-empty -- FR-12 embedding; omit path preserves 4-1 behavior.
- [x] `services/scanner/tests/test_harvest.py` -- proof null + populated schema-conformance; `has_high_severity`/`build_proof_block` pure tests -- matrix rows HAPPY_PATH/CAPTURE_FAILURE/SCHEMA_GATE.
- [x] `apps/web/tests/fixtures.ts`, `apps/web/tests/export.test.ts`, `apps/web/tests/report-surface.test.tsx` -- proof fixtures + export render/omit tests -- matrix rows EXPORT_WITH_PROOF/EXPORT_NO_PROOF/ALL_PASS.

**Acceptance Criteria:**

- Given a scan with at least one critical or serious violation, when the scan completes, then `ScanResult.proof` is a non-empty `{ mimeType: "image/png", dataBase64 }` block that validates against the canonical schema, and a capture failure never fails the scan (proof becomes `null`, scan succeeds).
- Given such a report, when it is exported, then the exported HTML contains a proof section with an `<img>` sourced from `data:image/png;base64,…`, business-language alt text, and no Developer/rule-ID vocabulary; the file opens standalone with the image visible.
- Given a scan with zero high-severity violations (or a failed capture), when it is exported, then the proof section is omitted and the export still succeeds with all 4-1 content intact — no placeholder and no failure.
- Given any export with a populated proof, then the proof block flows from the scanner through `translateAnalyst` into `AuditReport` and into the exported file with the field shape unchanged.

## Spec Change Log

_(Append-only; populated by step-03 implementation notes and step-04 review loops.)_

### 2026-08-18 — step-04 review loops applied + verification

Review loop 1 (7 patches) applied and verified:

1. **Scanner capture hardening** (`harvest.py`): `capture_proof` now wraps the screenshot in `asyncio.wait_for(..., timeout=SCREENSHOT_TIMEOUT_MS / 1000)` (constant `20_000`), catches broad `Exception` (not just `PlaywrightError`/`TimeoutError`), treats falsy bytes and bytes over `MAX_PROOF_BYTES` (2 MB) as `None`, and is documented never-to-raise. New unit tests against `_FakePage`/`_SlowPage`: non-Playwright exception degrades to `None`, empty bytes → `None`, oversized bytes → `None`, and the `asyncio.wait_for` timeout path via monkeypatched `SCREENSHOT_TIMEOUT_MS`.
2. **Export proof validation** (`export.ts`): added `BASE64_PATTERN` (`/^[A-Za-z0-9+/]*={0,2}$/`) and `isSafeProof` type guard (requires `mimeType === "image/png"`, string `dataBase64`, length ≥ 8, base64 alphabet); `renderProof` returns `""` unless the guard passes — non-object, wrong-mime, empty/too-short, or non-base64 proofs are all omitted, never interpolated.
3. **Hostname consistency**: new shared `parseHostname` (URL `.hostname` drops the port; regex fallback strips `:port`; `FALLBACK_HOSTNAME = "site"`); both `hostnameSlug` and exported `hostnameOf` derive from it. `exportFilename` and the proof-card alt text can no longer disagree on the port/path edge.
4. **Analyst passthrough tests** (`analyst.test.ts`): populated proof flows through `translateAnalyst` unchanged; null proof stays null.
5. **Chromium-gated live proof test**: new `services/scanner/tests/test_proof.py` runs `run_scan` against the new `services/scanner/tests/fixtures/proof.html` fixture (deliberate critical `image-alt` violation: `<img>` with no alt) served by the session-scoped `spa_fixture_server`; asserts a non-empty `{ mimeType: "image/png", dataBase64 }` proof whose bytes start with the PNG signature `\x89PNG\r\n\x1a\n`, then runs the whole envelope through `validate_envelope`. Skips when Chromium is unavailable, matching the other live-scan tests.
6. **Web export tests strengthened**: `EXPORT_WITH_PROOF` now round-trips the embedded base64 back to the source PNG signature bytes; added omit-branch tests (non-image/png mime, empty/too-short/non-base64 data, non-object proof) asserting no proof section and no `data:image/png` leak; `report-surface.test.tsx` gains a malformed (`text/html`) proof test asserting the downloaded blob omits the proof while the 4-1 priority section stays intact. Plus a `hostnameOf` describe (port-stripping, fallback on `not-a-url`, agreement with `exportFilename`).
7. **Architect passthrough test** (`architect.test.ts`): `translateArchitect` preserves a populated `report.proof` verbatim through the returned audit report.

Verification (post-patch): `uv run python -m pytest services/scanner/tests/ -v` **72/72** (incl. the new chromium-gated `test_proof.py`), `pnpm --filter @darkhouse/web test` **197/197**, `pnpm --filter @darkhouse/web lint` clean, `pnpm --filter @darkhouse/web build` succeeds under Next 16 Turbopack. Ruff findings remain pre-existing-only (UP017/UP041/I001). Deferred from this loop: email-clients stripping `data:` URIs from attachments (recorded in `deferred-work.md`) — the `data:` URI is right for the standalone file; the outreach channel is a future Epic-4 concern.

### 2026-08-18 — step-03 implementation + verification (step-04 pending)

Implemented story 4.2. Added an optional nullable `proof` block (`{ mimeType: const "image/png", dataBase64: minLength 8 }`, `additionalProperties: false`) to both `contracts/scan-result.schema.json` and `contracts/audit-report.schema.json` with the `required` lists and `schemaVersion` untouched, so pre-proof envelopes and zero-severity scans keep validating. Scanner: `harvest.py` gained `has_high_severity` (impact in critical/serious) and `build_proof_block` (base64 PNG), `build_scan_result` always emits `proof` (`None` or block), and `run_scan` takes a best-effort `page.screenshot(full_page=True)` after the vitals read when high-severity violations exist (PlaywrightError/TimeoutError degrades to `null`, never a scan failure). Web: `Proof` type + optional `proof` on `ScanResult` and `AuditReport`, `buildAuditReport` carries `proof: scanResult.proof ?? null` (threaded verbatim through `translateArchitect` via its spread), and `renderReportHtml` appends a `<section class="card proof">` with an `<img>` data-URI (`data:{mimeType};base64,{dataBase64}`) and business alt text "Broken experience on {hostname}" only for a non-empty proof, omitting it for null/absent (0-severity or failed capture) with all 4-1 sections intact; added `.proof img` CSS to the embedded stylesheet. `makeReport` gained the optional `proof` param. No new dependencies; no PDF; no Developer vocabulary in the proof section.

Tests: scanner `test_harvest.py` extended for `proof: null` and populated blocks against the updated schema, a malformed-proof schema-gate rejection, and pure `has_high_severity`/`build_proof_block` coverage (no browser); web `export.test.ts` added EXPORT_WITH_PROOF (data-URI img + section), EXPORT_NO_PROOF (omitted, 4-1 intact), ALL_PASS (0-severity still exports without section), and no-Developer-vocabulary-with-proof; `report-surface.test.tsx` added EXPORT_WITH_PROOF (downloaded blob contains the proof section, zero fetch). Step-03 verification: `uv run python -m pytest services/scanner/tests/ -v` 64/64 (incl. chromium-gated live scan), `pnpm --filter @darkhouse/web test` 187/187, `pnpm --filter @darkhouse/web lint` clean, `pnpm --filter @darkhouse/web build` succeeds under Next 16 Turbopack. Pre-existing ruff findings (UP017/UP041/I001) unchanged. Next: step-04 review.

Matrix Test Audit follow-up (step-03 verification): extracted the capture seam into a unit-testable `capture_proof(page, violations)` async helper in `harvest.py` (uses `has_high_severity` + best-effort screenshot, decoupled from Playwright's page type via `Any`) so the CAPTURE_FAILURE and HAPPY_PATH capture-path I/O rows have real covering tests instead of relying on the pure helpers alone. `run_scan` now delegates to the helper. Added `test_capture_proof_skipped_without_high_severity`, `test_capture_proof_happy_path_full_page`, and `test_capture_proof_capture_failure_degrades_to_none` against a `_FakePage` stub. Re-ran: scanner suite 67/67 (was 64 after the follow-up), web 187/187, lint clean, build OK.

## Design Notes

- **Format-agnostic proof block.** PRD OQ-3 leaves full-page vs cropped unsettled. Shipping `{ mimeType, dataBase64 }` keeps the contract stable: switching capture style changes only `harvest.py`, never the schema, web types, or export. Full-page is the initial default because node coordinates are frequently `null` (per test fixtures), making node-cropping fragile.
- **Null is a first-class state.** The proof field is optional-nullable in both schemas so zero-severity scans and any pre-proof consumer keep validating. The exporter treats `null`/absent as "omit the section" — matching FR-12 AC 2 and the epic constraint that the export must tolerate the artifact's final format.
- **Best-effort mirrors vitals.** `run_scan` reads vitals best-effort (existing pattern, line 285). Screenshot capture gets the same treatment: a blocked page or CORS/rendering hiccup degrades to `null` rather than a typed scan error, honoring NFR-2 over FR-12 completeness. The AC "no proof is ever empty" is enforced when proof is present, not by failing scans.
- **Base64 is safe to interpolate.** `dataBase64` uses only the base64 alphabet (`A–Z a–z 0–9 + / =`), so direct interpolation into the `src` attribute is unescapable in practice; `mimeType` is a schema `const`. No `escapeHtml` change needed.

## Verification

**Commands:**

- `uv run python -m pytest services/scanner/tests/ -v` -- expected: new proof tests green; all existing scanner tests green against the updated schema.
- `pnpm --filter @darkhouse/web test` -- expected: new export/report-surface proof tests green alongside the existing suite.
- `pnpm --filter @darkhouse/web lint` -- expected: clean.
- `pnpm --filter @darkhouse/web build` -- expected: succeeds under Next 16 Turbopack.

**Manual checks (if no CLI):**

- Run a scan of a page with a known contrast or alt-text failure against a live scanner, export the report, and confirm the downloaded HTML shows the broken-experience screenshot inline with all styling and no console errors.

## Suggested Review Order

**The capture seam — where the proof is produced**

- Best-effort screenshot capture: high-severity gate, bounded call, empty/size/exception guards degrade to null, never a scan failure
  [`harvest.py:193`](../../services/scanner/app/harvest.py#L193)

- The capture call inside the live scan, threading proof into the envelope
  [`harvest.py:352`](../../services/scanner/app/harvest.py#L352)

- Pure base64 PNG block builder; pure critical/serious decision gate
  [`harvest.py:143`](../../services/scanner/app/harvest.py#L143)
  [`harvest.py:154`](../../services/scanner/app/harvest.py#L154)

**The contract — canonical proof shape in both schemas**

- Optional nullable proof block (`mimeType` const, `dataBase64` minLength) on the ScanResult envelope
  [`scan-result.schema.json:43`](../../contracts/scan-result.schema.json#L43)

- Mirrored proof property on the AuditReport envelope
  [`audit-report.schema.json:43`](../../contracts/audit-report.schema.json#L43)

**The export — proof embedded only when structurally valid**

- `isSafeProof` runtime gate (web has no schema validator): mimeType pin + base64 alphabet + length before any interpolation
  [`export.ts:209`](../../apps/web/lib/export.ts#L209)

- `renderProof` emits the proof section only past the gate, business alt text
  [`export.ts:223`](../../apps/web/lib/export.ts#L223)

- Shared hostname parsing so filename and alt text cannot disagree
  [`export.ts:46`](../../apps/web/lib/export.ts#L46)

**The passthrough — proof surviving translation**

- `buildAuditReport` carries proof from ScanResult into AuditReport
  [`analyst.ts:127`](../../apps/web/lib/translate/analyst.ts#L127)

**Tests & schema gate (peripheral)**

- Chromium-gated live proof: real critical page → PNG-signature proof, schema-valid
  [`test_proof.py:48`](../../services/scanner/tests/test_proof.py#L48)

- Fake-page capture-path matrix (happy, skipped, failure → null)
  [`test_harvest.py:164`](../../services/scanner/tests/test_harvest.py#L164)

- Web export: round-trip decode, omit branches, malformed-proof download
  [`export.test.ts:138`](../../apps/web/tests/export.test.ts#L138)

- Analyst/architect passthrough pins proof survival
  [`analyst.test.ts:74`](../../apps/web/tests/analyst.test.ts#L74)
  [`architect.test.ts`](../../apps/web/tests/architect.test.ts)
