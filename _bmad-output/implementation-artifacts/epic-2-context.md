# Epic 2 Context: Understand & Fix (AI Translation)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Translate the machine-readable `ScanResult` (violations + vitals) from Epic 1 into two AI-persona outputs: the **Analyst** produces a plain-English business-impact explanation per high-severity violation plus a business-impact-ranked remediation priority list, and the **Architect** produces a proposed, production-ready React/Tailwind patch (diff + rationale) for each prioritized violation. The dashboard renders each patch as a reviewable line-by-line diff under an explicit "proposed, not applied" status. This is the Translate stage — the layer that turns a rule dump a stakeholder can't read into a business narrative a client can act on and fixes a developer can review. Patches are proposed, never auto-applied (product invariant).

## Stories

- Story 2.1: Translate violations into business impact (Analyst persona)
- Story 2.2: Generate proposed React/Tailwind patches (Architect persona)
- Story 2.3: Render patches as reviewable diffs

## Requirements & Constraints

- Every high-severity violation must carry an Analyst impact block: human-facing failure, affected user segment, WCAG consequence, and a reasoned conversion/compliance impact estimate — none may be empty or placeholder.
- Each impact block cites its source violation ID and WCAG reference. Impact estimates use hedging language ("plausibly," "may," "roughly") — never false certainty or overclaimed causal attribution.
- Violations are ranked highest-business-impact-first into a remediation priority list that is stable across identical inputs.
- Each Architect patch contains a machine-readable diff and a rationale referencing the violation ID and WCAG rule, and carries `status: proposed`.
- No code path in either tier applies a patch to any repository — auto-apply must be structurally impossible, not just discouraged.
- The AI layer degrades gracefully if a free-tier provider is rate-limited; the free-tier defaults keep full runs at zero recurring cost. No paid-model support in v1. Patch targets are React + Tailwind only.
- High-severity violations winning a patch: target ≥ 80% of Analyst-prioritized violations receiving an Architect patch; applied-patch regressions stay at zero.

## Technical Decisions

- Personas are independent modules (`apps/web/lib/translate/analyst`, `.../architect`) living in the Next.js tier, the pipeline's only orchestrator; the Python service never calls AI.
- Personas talk to an OpenAI-compatible chat interface; provider/model are configuration-driven (`A11Y_AI_PROVIDER`, `A11Y_AI_MODEL`, `A11Y_AI_KEY`), never hardcoded, with free-tier defaults.
- The `AuditReport` schema (the enriched envelope: violations + vitals + analyst impacts + architect patches) and the raw `ScanResult` are two versions of the same canonical envelope in `contracts/`; `schemaVersion` is mandatory and both languages validate against the shared schema. No other interchange format crosses the tier boundary.
- Patches carry `status: proposed` plus the WCAG rule and affected nodes (`nodeId`s from the ScanResult). Reports are immutable; re-scans produce a new `scanId` (ULID). Dates ISO-8601 UTC; error envelope `{ code, message, stage }`; severity vocabulary critical / moderate / minor.
- Pipeline stage timings (scan → translate → render) are logged for observability.

## UX & Interaction Patterns

- Diff/Review panel: always-dark surface regardless of theme, monospace, per-line `+/-/ ` gutter with red/green/gray change colors, muted line numbers, wrap at ~100 chars, ~one logical change per block, and a copy action.
- A visible "Proposed — not applied" badge accompanies every patch; there is no apply-to-code control anywhere in the UI.
- Diff text reflows without horizontal clipping at 150% zoom; touch targets ≥ 44px; keyboard-operable; instant under Reduce Motion.
- Patch-review copy stays neutral ("Proposed — not applied. Review before merging.") — never "Fix generated ✓".
- Dual-register microcopy: impact language is plain business English with estimate hedging; anything the client reads must not require decoding rule IDs.

## Cross-Story Dependencies

- 2.1 consumes the Epic 1 `ScanResult` (violations) and writes the enriched `AuditReport`; its ranking output feeds 2.2.
- 2.2's patches land on the same `AuditReport`; 2.3 renders them.
- 2.1's analyst impacts and 2.2's patches are consumed by Epic 3's Client View (priority list) and Developer View (technical rows linking to the diff panel).
- Story 1.4's status surface already shows the "Translating" stage and its rate-limit pause state, which the personas' graceful degradation must honor.