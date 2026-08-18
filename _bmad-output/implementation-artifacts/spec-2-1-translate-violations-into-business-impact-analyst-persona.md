---
title: '2-1: Translate violations into business impact (Analyst persona)'
type: 'feature'
created: '2026-08-16'
baseline_commit: 'a1bb6235c7c0837958d41a96050ebfdfa9494265'
status: 'done'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** The translate stage does not exist — a ScanResult's violations are machine-readable rule dumps, so a non-technical stakeholder cannot judge which failures hurt the business most or what each one costs in conversions or compliance.

**Approach:** Build the Analyst persona as a web-tier module (`apps/web/lib/translate/analyst.ts`) that consumes a ScanResult, resolves an OpenAI-compatible provider/model from env config, produces a hedged, plain-English business-impact block for every high-severity violation, returns them ranked highest-business-impact-first in a deterministic order, and records translate-stage timings. High-severity = `impact ∈ {critical, serious}` (axe vocabulary; schema enum). The module returns an AuditReport-shaped envelope (violations + vitals + `analyst_impacts` + empty `architect_patches`) so the enriched contract is in place for stories 2.2/2.3.

## Boundaries & Constraints

**Always:**
- Personas live only in the web tier; the Python scanner never calls AI (AD-1). The module never persists anything (stateless filter).
- Provider/model are config-driven, never hardcoded: resolve `A11Y_AI_PROVIDER`, `A11Y_AI_MODEL`, `A11Y_AI_KEY` from env with free-tier defaults; API key is optional (some free providers are keyless) and sent as `Authorization: Bearer` only when present.
- Provider communication is an OpenAI-compatible `POST {provider}/chat/completions` via the runtime's global `fetch` (no new SDK dependency, keeps provider lock-in impossible).
- Every high-severity violation in the input MUST receive an impact block: `violation_id`, `business_problem`, `affected_segment`, `wcag_consequence`, `conversion_impact_estimate` — all non-empty, no placeholder text. The block's WCAG reference lives in `wcag_consequence` (schema has no separate WCAG-ref field; `violation_id` carries the source ID).
- Impact copy uses hedging ("plausibly" / "may" / "roughly"); never false certainty or overclaimed causal attribution.
- The returned `analyst_impacts` array IS the ranking: ordered highest-business-impact-first, and ordering is deterministic for identical inputs (severity weight, then `violation_id` tiebreak).
- Translate-stage timing is recorded (start, end, duration, `scanId`) and logged (`[darkhouse] translate ...`); timings are observability, not an envelope field.
- Full TLS-only OpenAI-compatible endpoints; errors are typed `{ code, message, stage }` with `stage: "translate"`.

**Ask First:**
- The concrete free-tier default provider URL to ship (OQ-1 is open in the PRD: DeepSeek vs Gemini free vs Groq vs local Ollama). Until decided, the default `A11Y_AI_PROVIDER` value is an explicit placeholder under discussion, and the module must still work when a provider URL is supplied via env.
- Whether a scan with zero high-severity violations should emit an empty `analyst_impacts` array (proposed: yes — empty, schema-valid, no AI call).

**Never:**
- No patch generation, no auto-apply, no storage/persistence, no UI changes, and no wiring of translate into the `/api/scan` orchestrator seam (route wiring belongs to a later Epic 2 story). 2.1 is the standalone persona module + its tests.
- Do not alter `contracts/*.schema.json` (the analyst_impact scaffold already matches this story's output shape); do not modify scanner code.
- No real-network calls in tests; the provider client is injection-friendly/mockable.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | ScanResult with >=1 `critical`/`serious` violation; provider returns valid ordered block JSON | AuditReport envelope with one non-empty block per high-severity violation; array ordered business-impact-first with deterministic tiebreak; timings logged | N/A |
| ERROR_CASE | Provider responds HTTP 429 (rate limit) | No fabricated text; typed error `{ code: "rate_limited", stage: "translate" }` (maps to the UI's paused state later) | Retryable — never a fabricated fallback block |
| ERROR_CASE | Provider network failure / non-JSON body / 4xx-5xx other than 429 / block missing a required field / a high-severity violation absent from the response | Typed error `{ code: "translate_error", stage: "translate" }`; nothing partial written | Never down-samplers to lower quality; the run fails typed |
| EDGE_CASE | ScanResult with zero high-severity violations | Empty `analyst_impacts` array, schema-valid AuditReport, no provider call | N/A |
| EDGE_CASE | Provider response contains duplicate or unknown `violation_id`s | Duplicates/unknowns dropped; every high-severity violation still covered exactly once | N/A |
| EDGE_CASE | `A11Y_AI_PROVIDER`/`A11Y_AI_MODEL` unset | Free-tier defaults used; keyless request if `A11Y_AI_KEY` absent | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/lib/scan.ts` -- existing hand-written ScanResult/Violation types + `submitScan`; `Violation.impact` enum (`critical/serious/moderate/minor`). The Analyst consumes this shape's `violations`.
- `apps/web/lib/translate/analyst.ts` -- NEW. The Analyst persona: `translateAnalyst(scanResult, deps)` returns an AuditReport-shaped envelope; internal `readAiConfig()`, OpenAI-compatible `chat()` client (injectable `fetch`), prompt builder, response parser/validator, deterministic sorter, timing recorder. Exports `AnalystImpact`/`AuditReport` TS types mirroring `contracts/audit-report.schema.json`.
- `contracts/audit-report.schema.json` -- canonical `analyst_impact` definition (`violation_id`, `business_problem`, `affected_segment`, `wcag_consequence`, `conversion_impact_estimate`) and envelope fields (`analyst_impacts`, `architect_patches`). Read-only; the module must emit shapes that pass this schema (analyst_impacts empty or fully valid).
- `_bmad-output/implementation-artifacts/epic-2-context.md` -- FR-4/FR-5/ADR-6/ADR-7/UXD-14 distillation; the AC source for hedged copy, stable ranking, and env config names.
- `apps/web/tests/` -- vitest + jsdom (UI) / `// @vitest-environment node` (server/route) suites; `vi.stubEnv`/`vi.stubGlobal` patterns from `tests/route.test.ts`. New `analyst.test.ts` follows these conventions.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/lib/translate/analyst.ts` -- create `AnalystImpact`/`AuditReport` TS types + `translateAnalyst` persona (config resolution, injectable OpenAI-compatible chat via global fetch, prompt builder, validated parser, deterministic ranking, timing logging, typed translate-stage errors) -- FR-4/FR-5/ADR-6/ADR-7/UXD-14.
- [x] `apps/web/tests/analyst.test.ts` -- unit tests pinning the I/O matrix (happy path with mocked provider response, 429 → `rate_limited`, malformed/missing/failed provider → `translate_error`, zero high-severity → empty impacts + no call, duplicate/unknown violation_ids dropped, deterministic order across identical inputs, env defaults resolved) -- AC 1-4.
- [x] Self-review against READY FOR DEVELOPMENT standard.

**Acceptance Criteria:**
- Given a ScanResult with high-severity violations, when translated by the Analyst persona, then every high-severity violation carries a business-impact block with `business_problem`, `affected_segment`, `wcag_consequence`, and a reasoned `conversion_impact_estimate` — all non-empty.
- Given an impact block, then it cites its source `violation_id` and WCAG reference, and every impact estimate uses hedging ("plausibly"/"may"/"roughly") with no false certainty.
- Given the same valid ScanResult twice, then the returned `analyst_impacts` are ordered identically (highest business impact first, deterministic tiebreak).
- Given config `A11Y_AI_PROVIDER`/`A11Y_AI_MODEL`/`A11Y_AI_KEY`, then the persona resolves them (free-tier defaults when unset) and records + logs translate-stage start/end/duration keyed by `scanId`.

## Spec Change Log

- 2026-08-16: Implemented story 2.1. Added `apps/web/lib/translate/analyst.ts` (Analyst persona) and `apps/web/tests/analyst.test.ts` (14 unit tests). Verified: `pnpm --filter @darkhouse/web test` (57 pass), lint clean, build succeeds. Story moved to `review` in sprint-status.yaml.
- 2026-08-16 (review loop 1): Three-layer code review (blind-hunter, edge-case-hunter, verification-gap) merged. Patches applied: `chat()` now aborts via `AbortSignal.timeout(CHAT_TIMEOUT_MS)` so a hanging provider can't stall (timeout maps to a named `translate_error`); `translateAnalyst` guards a null/absent-`violations` scan with a typed `translate_error` and normalizes any non-`TranslateError` in the catch; `readAiConfig` strips one trailing `/` from `A11Y_AI_PROVIDER`; the translate error log now carries `message`; `highSeverityViolations` uses `HIGH_IMPACTS.includes(...)` and `affectedNodeCount` tolerates a missing `nodes` array; new test pins the built system prompt's hedging + JSON-array-only directives (a regression deleting the hedging instruction now fails a test — previously masked by canned mock text). Deferred entries logged in `deferred-work.md` (schema-version scheme, contract-types generation + runtime schema validation, MAX_TOKENS budget/finish_reason, JSON bracket-slicing via prompt-wrapped replies, URL passthrough to provider). Rejected with evidence: snake_case analyst_impacts/architect_patches names match the schema exactly; no preflight key check is correct (keyless providers supported); `nodes`/`vitals` presence is contract-guaranteed; non-streaming is the default so `stream:false` is unnecessary. KEEP: injectable `fetch`/`now` deps pattern, deterministic severity→id ranking, `rate_limited` vs `translate_error` split mapping to story 1.4's paused surface, typed-error envelope `{ code, message, stage }`.
- 2026-08-16: Approved final by user ([A] Approve final, review loop 1). Story closed `done`; sprint-status.yaml updated (2-1 done, 2-2 in-progress); spec status set `done`. Proceeding to story 2.2 (Architect persona).

## Design Notes

- **No schema change:** `contracts/audit-report.schema.json` already scaffolds `analyst_impact` with every field this story emits. The persona is contract-first: it writes only envelope fields the schema allows (`additionalProperties: false`), so a schema validation pass (when the web tier gains one) succeeds.
- **Deterministic ranking:** the LLM's own output order may flip on identical inputs, so the module re-orders by a deterministic comparator — severity weight (`critical` < `serious`), then `violation_id` ascending — guaranteeing AC 3 without suppressing the model's impact ranking signal.
- **Graceful rate-limit:** 429 surfaces as a typed, retryable `rate_limited` translate-stage error rather than a synthetic block, so story 1.4's "Translation is waiting on a free-tier limit — retrying." paused surface can map to it when translate is wired into the pipeline.
- **Injectability:** `translateAnalyst(scanResult, deps?)` accepts an overridable `fetch` (and optional timing `now()`), so vitest pins every matrix row without network.

## Verification

**Commands:**
- `pnpm --filter @darkhouse/web test` -- expected: all vitest suites including new `analyst.test.ts` pass.
- `pnpm --filter @darkhouse/web lint` -- expected: clean ESLint.
- `pnpm --filter @darkhouse/web build` -- expected: typecheck + build succeed.

**Manual checks (if no CLI):**
- Point `A11Y_AI_PROVIDER` at a local OpenAI-compatible mock and confirm a live `translateAnalyst` run logs the translate timings and returns an envelope matching `contracts/audit-report.schema.json`.