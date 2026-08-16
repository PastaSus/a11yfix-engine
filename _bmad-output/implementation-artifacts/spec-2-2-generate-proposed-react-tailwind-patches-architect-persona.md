---
title: '2-2: Generate proposed React/Tailwind patches (Architect persona)'
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

**Problem:** A developer still hand-authors every remediation — the Analyst's business-impact text tells them what to fix and why, but not what code change fixes it.

**Approach:** Build the Architect persona as a web-tier module (`apps/web/lib/translate/architect.ts`) that consumes the Analyst-ranked AuditReport, resolves the same OpenAI-compatible provider from env, asks the model to propose one React/Tailwind unified-diff patch per prioritized violation (in order), validates each patch (machine-readable diff + rationale referencing the violation id and WCAG rule), stamps `status: "proposed"` itself (const, never trusted from the model), and records translate-stage timings. Returns an AuditReport with `architect_patches` populated; nothing is ever applied.

## Boundaries & Constraints

**Always:**
- Personas live only in the web tier; the module never persists anything. Patches always carry `status: "proposed"` set by the module from a constant — the model cannot set it. No code path in either tier applies a patch to any repository (structural invariant, not just policy).
- The Architect shares the OpenAI-compatible chat client with the Analyst: extract the shared client, config, error, parsing, and envelope types into `apps/web/lib/translate/client.ts`; refactor `analyst.ts` to use it (its public API and 14 tests unchanged); `architect.ts` imports the same client. No duplicated fetch/timeout/429/error handling.
- Provider/model are config-driven via `A11Y_AI_PROVIDER`, `A11Y_AI_MODEL`, `A11Y_AI_KEY` with the same free-tier defaults as 2.1; API key optional (keyless providers supported).
- Exactly one patch per prioritized (analyst_impact) violation, in the same order. `architect_patch` has no `violation_id` field in the schema, so positional order is the only sound violation↔patch link; the rationale also references the violation id and WCAG rule in prose.
- Each patch passes validation: `diff` is a git-style unified diff (contains at least one `+` and one `-` line), `rationale` is a non-empty string referencing the violation id and WCAG rule, `wcag_rule` is non-empty. On any error nothing partial is written; the run fails typed.
- Translate-stage timings recorded and logged (`[a11yfix] translate ...`) keyed by `scanId`; errors typed `{ code, message, stage: "translate" }`.

**Ask First:**
- None new. OQ-1 (concrete free-tier default provider) is still open from 2.1; reuse the placeholder defaults — works once `A11Y_AI_PROVIDER` is supplied.

**Never:**
- No auto-apply, no storage/persistence, no UI changes, no wiring of translate into `/api/scan` (route wiring belongs to a later Epic 2 story). 2.2 is the standalone persona module + its tests.
- Do not alter `contracts/*.schema.json` (the `architect_patch` scaffold already fits this story's output shape); do not modify scanner code.
- No real-network calls in tests; the provider client is injection-friendly/mockable.
- Do not duplicate the chat client — refactor to the shared `client.ts` rather than copying.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | AuditReport with `analyst_impacts`; provider returns one valid patch per violation in order | AuditReport whose `architect_patches` maps 1:1 to impacts in the same order; each `status: "proposed"`, diff has `+`/`-` lines, rationale references violation id + WCAG rule; timings logged | N/A |
| ERROR_CASE | Provider responds HTTP 429 (rate limit) | No fabricated text; typed error `{ code: "rate_limited", stage: "translate" }` | Retryable — never a fabricated patch |
| ERROR_CASE | Provider network failure / non-JSON body / non-array / malformed JSON / patch missing a required field / diff without `+` and `-` lines / a prioritized violation absent from the response / an impact whose `violation_id` has no matching scan violation | Typed error `{ code: "translate_error", stage: "translate" }`; nothing partial written | Run fails typed — never a lower-quality down-sample |
| EDGE_CASE | AuditReport with zero `analyst_impacts` | Empty `architect_patches` array, no provider call | N/A |
| EDGE_CASE | Same valid AuditReport twice | Identical `architect_patches` arrays (order = impact order; no AI-visible ordering signal to flip) | N/A |
| EDGE_CASE | `A11Y_AI_PROVIDER`/`A11Y_AI_MODEL`/`A11Y_AI_KEY` unset | Free-tier defaults used; keyless request | N/A |

</frozen-after-approval>

## Code Map

- `apps/web/lib/translate/client.ts` -- NEW. Shared provider-agnostic client: `DEFAULT_AI_PROVIDER`, `DEFAULT_AI_MODEL`, `AiConfig`, `ChatMessage`, `TranslateDeps`, `TranslateError`, `TranslateErrorCode`, `readAiConfig()`, `readChatContent()`, `chat()` (now takes a `maxTokens` param), `extractJsonArray()`, plus the shared envelope types `AnalystImpact`, `ArchitectPatch`, `AuditReport`. Re-exported from `analyst.ts` so its public API and tests are untouched.
- `apps/web/lib/translate/analyst.ts` -- REFACTOR. Imports the shared client from `./client`; keeps persona-specific `buildTranslatePrompt`, `parseImpacts`, `rankImpacts`, `highSeverityViolations`, `translateAnalyst`. Re-exports `DEFAULT_AI_PROVIDER`, `DEFAULT_AI_MODEL`, `TranslateError`, and the envelope types for backward compatibility. The 14 existing tests must pass unchanged (regression guard).
- `apps/web/lib/translate/architect.ts` -- NEW. The Architect persona: `translateArchitect(auditReport, deps?)` returns an AuditReport with `architect_patches`; internal input guard, prompt builder, validated parser, `"proposed"` stamp, timing recorder. Exports `MAX_PATCH_TOKENS` (diff generation is verbose; a larger budget than the Analyst's).
- `contracts/audit-report.schema.json` -- READ-ONLY. Canonical `architect_patch` (`status` const `proposed`, `diff`, `rationale`, `wcag_rule`; `additionalProperties: false`; NO `violation_id` — hence the positional link). Envelope already fits; never hand-edit.
- `apps/web/tests/analyst.test.ts` -- unchanged; must stay green after the client extraction.
- `apps/web/tests/architect.test.ts` -- NEW vitest suite (node environment) mirroring `analyst.test.ts` patterns: `vi.stubEnv`, fake `fetch`, `chatResponse`/`makeFake` helpers, `afterEach` stubs.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/lib/translate/client.ts` -- create shared client module (config, chat with `maxTokens` param, errors, JSON parsing, envelope types) extracted from `analyst.ts` -- so the Architect reuses the hardened client instead of duplicating it (FR-6, ADR-5, ADR-6, AD-7).
- [x] `apps/web/lib/translate/analyst.ts` -- refactor to import shared client; re-export public API unchanged -- regression-proof; existing tests pass without edits.
- [x] `apps/web/lib/translate/architect.ts` -- create `translateArchitect` persona (input guard, one-patch-per-impact prompt, validated parser, `"proposed"` stamp, timings) -- FR-6, ADR-5, ADR-6.
- [x] `apps/web/tests/architect.test.ts` -- unit tests pinning the I/O matrix rows (happy path, 429 → `rate_limited`, transport/parse/validation failures → `translate_error`, zero impacts → empty + no call, deterministic order, env defaults, prompt-body directives incl. unified-diff + one-object-per-violation-in-order) -- AC 1-4.
- [x] Self-review against READY FOR DEVELOPMENT standard.

**Acceptance Criteria:**
- Given an AuditReport with `analyst_impacts`, when `translateArchitect` runs, then `architect_patches` contains exactly one patch per impact in the same order, each with `status: "proposed"`, a machine-readable unified diff (has `+` and `-` lines), and a rationale referencing the violation id and WCAG rule.
- Given the same valid AuditReport twice, then the returned `architect_patches` arrays are identical.
- Given any patch in the report, then no code path in either tier applies it to a repository (the module returns data only; `status` is a const).
- Given config `A11Y_AI_PROVIDER`/`A11Y_AI_MODEL`/`A11Y_AI_KEY`, then the persona resolves them (free-tier defaults when unset) and records + logs translate-stage start/end/duration keyed by `scanId`.

## Spec Change Log

- 2026-08-16: Implemented story 2.2. Added `apps/web/lib/translate/client.ts` (shared provider client extracted from analyst.ts), refactored `apps/web/lib/translate/analyst.ts` to import it (public API + 14 tests unchanged), added `apps/web/lib/translate/architect.ts` (Architect persona: `translateArchitect` with input guard, positional one-patch-per-impact prompt, validated parser that stamps `status: "proposed"` from a const and drops any provider-returned status, exact coverage + ordering enforcement, `MAX_PATCH_TOKENS = 2048`), and `apps/web/tests/architect.test.ts` (19 tests). Verified: `pnpm --filter @a11yfix/web test` (77 pass, 58 regression + 19 new), lint clean, build succeeds. Step-03 verification: all Tasks & AC met; Matrix Test Audit passed (every I/O matrix row covered by a passing test). Next: step-04 review.
- 2026-08-16 (review loop 1): Three-layer review (blind-hunter, edge-case-hunter, verification-gap) merged. 8 patches + 2 test-coverage fixes applied (via the step-03 subagent): `chat()` timeout detection now guards the `DOMException` reference for runtimes without the global; `readAiConfig` strips all trailing slashes (was one); `TranslateError` accepts an optional `{ cause }` and `chat()` attaches the underlying fetch error as `cause` for diagnosability (no body logged); new tests pin the provider-timeout message, the `JSON.parse`-failure branch of `extractJsonArray` (`"[not json]"`), the no-usable-content branch of `chat()` (`{ choices: [] }`), trailing-slash env normalization, and the previously-unpinned `translateAnalyst` invalid-input guard (null/undefined `violations` → typed error, zero fetch); trailing newlines added to `analyst.ts`/`architect.ts`/`analyst.test.ts`. Verified: 82 tests pass (77 → 82, +5), lint clean, build succeeds. Rejected with evidence: no-wiring concern is explicitly deferred to a later story (dead code is intentional this story); "extra keys not rejected" is by design — the module is a filter that drops provider fields (e.g. `status`) and the const-stamp test asserts exact keys; `rate_limited` no-retry and `extractJsonArray` bracket-slicing were already logged as deferred in spec-2-1's review; validator strictness, fixed token budgets, and ungrounded diffs are product-level and recorded in `deferred-work.md`. KEEP: the shared `client.ts` extraction and unchanged Analyst API/tests (regression guard pattern), positional one-patch-per-impact mapping with exact count + order enforcement, `status: "proposed"` const-stamp that ignores provider status, prompt-body directive assertions (unified-diff + one-object-per-violation-in-order), injectable `fetch`/`now` deps, and the logged `{ code, message, stage }` envelope.

## Design Notes

- **Positional 1:1 mapping:** `architect_patch` has no `violation_id` field, so the patch↔violation link is positional: `architect_patches[i]` ↔ `analyst_impacts[i]`. The Analyst already guarantees one impact per high-severity violation in deterministic priority order, so patches inherit that determinism. Full coverage is required (any missing patch → typed `translate_error`); the epic's "≥ 80% of prioritized violations get a patch" is a pipeline-level KPI measured across real runs, not a partial-output contract the module emits.
- **Token budget:** `chat()` gains a `maxTokens` parameter. The Architect uses `MAX_PATCH_TOKENS` (≈ 2048) because unified diffs are verbose; the Analyst keeps its current 1024. A truncation still degrades to a typed `translate_error` (bounded); dynamic budgets are tracked in deferred-work.md.
- **`status: "proposed"` is a constant:** the module writes it; the model never returns it. Combined with "returns data only", auto-apply is structurally impossible (AC 3).
- **Prompt shape:** instructs git-style unified-diff output (`---`/`+++` headers, `@@` hunks, `+`/`-` lines), exactly one patch object per violation in the given order, and a JSON-array-only reply; validation requires ≥ 1 `+` and ≥ 1 `-` line so story 2.3's line gutter always has content to render.

## Verification

**Commands:**
- `pnpm --filter @a11yfix/web test` -- expected: all suites pass, including the unchanged `analyst.test.ts` (client-refactor regression guard) and the new `architect.test.ts`.
- `pnpm --filter @a11yfix/web lint` -- expected: clean ESLint.
- `pnpm --filter @a11yfix/web build` -- expected: typecheck + build succeed.
