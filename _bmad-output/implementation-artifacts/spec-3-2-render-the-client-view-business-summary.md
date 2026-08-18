---
title: '3-2: Render the Client View (business summary)'
type: 'feature'
created: '2026-08-17'
status: 'done'
baseline_commit: '5223bdcd056f09ef5ec07e82bc9a0e1293970f33'
review_loop_iteration: 1
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/EXPERIENCE.md'
  - '_bmad-output/implementation-artifacts/spec-3-1-establish-the-design-foundation-and-report-surface.md'
  - '_bmad-output/implementation-artifacts/spec-2-1-translate-violations-into-business-impact-analyst-persona.md'
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
---

## Intent

**Problem:** The report surface (3.1) ships its Client View as two placeholder cards — "Executive summary" and "Priority issues" — that currently read "lands here in a later release." The `AuditReport` prop already carries every piece of the Client View's content: `analyst_impacts`, the Analyst's deterministic, highest-business-impact-first ranked list from 2.1, plus the severity tiers already counted by the header. A non-technical stakeholder still cannot state the top problems or their business cost from the report alone — which is the whole point of the dual-audience design (FR-9, UX-DR7).

**Approach:** Replace the two Client View placeholders with the real business summary: (1) an executive-summary metric block whose largest numbers are the frozen severity counts — large tabular figures with text labels and container-tinted chips; and (2) the priority list, an `<ol>` of Analyst-ranked remediation items rendered in their given array order, each showing the full AnalystImpact block in business register (human problem, affected users, WCAG consequence, hedged impact estimate) with an accessible "view fix" action that instantly switches the audience toggle to Developer. The empty (all-pass) state is restrained and points to the Developer View. Reads only the passed `AuditReport` — no fetch, no re-scan, no AI, no route — matching 3.1's standalone-module seam. Extracted into its own component so 3.3 can extract the symmetric Developer View.

## Boundaries & Constraints

**Always:**
- The surface consumes only data already in the passed `AuditReport` — no fetch, no re-scan, no AI/translate call, no back-end work, no route/navigation.
- The priority list renders `analyst_impacts` in array order — the array IS the Analyst ranking from 2.1 (severity weight, then `violation_id` tiebreak). No re-sorting, no filtering, no truncation.
- Each priority item renders the full `AnalystImpact` block verbatim from the report: `business_problem`, `affected_segment`, `wcag_consequence`, `conversion_impact_estimate`. No re-hedging, no word-smithing, no injected certainty. Never raw rule IDs, `helpUrl`, or selectors — those are Developer View vocabulary (3.3).
- "view fix" is a real action now: pressing it switches `audience` to `developer` instantly (existing toggle state, `aria-pressed` hand-off) **and persists the Developer choice to `sessionStorage` exactly like a toggle press** — the 3.1 STICKY_SESSION capability must not regress through this alternate switch path. Zero data reload and **no auto-scroll** (banned interaction). The callback carries the item's `violation_id` — that single value is the 3.3 targeting seam; 3.2 must not implement scroll-to-row/focus.
- Severity is never conveyed by color alone — the metric block pairs tinted containers with visible text labels, and the large figures carry business-phrase screen-reader labels (`aria-label="12 critical issues"`, text `12`) per UX-DR12. The metric block's accessible name is **distinct from the header's** (e.g. "Executive summary severity counts") so the two count groups are not identically named.
- Severity counts come from the frozen tier mapping only (`severityTier` + shared `countTiers`, extracted from the header so both read one mapper).
- The all-pass / no-critical empty state is restrained and accurate to the data: **the "No critical violations detected." register renders only when `counts.critical === 0`** — never conditioned on `analyst_impacts` presence, because a raw/untranslated report carries critical violations but an empty impacts array. The register points to the Developer View for full detail and is never "All good!" (EXPERIENCE.md copy). When `counts.critical > 0` but `analyst_impacts` is empty, the view shows the metric figures plus a restrained "impact analysis unavailable — see the Developer view" note that does not claim conformance.
- Interactive: "view fix" buttons focusable + labelled, visible `focus-visible` ring (tokenized), fully keyboard-operable, touch targets ≥ 44px (`h-11`), **no transitions** (Reduce Motion).
- Responsive: the two cards wrap/stack on narrow viewports, nothing hidden, toggle stays reachable.

**Ask First:**
- Extracting `ClientView` from `report-surface.tsx` into a sibling `client-view.tsx` — a structural change to a 3.1-owned file. Proposed so 3.3 mirrors it; user to confirm.
- Whether the executive-summary block also renders a derived health line beyond the counts (reusing the header's `healthFor` label) or stays strictly figures + labels.

**Never:**
- No route, persistence, navigation, or API call in 3.2; the wiring deferral recorded in `deferred-work.md` stands.
- No re-sorting/aggregating/summarizing of `analyst_impacts`; do not fight the Analyst's ranking.
- No "view fix" deep-targeting, scroll-to-element, or Developer-View content — the Developer slot stays 3.1's placeholder until 3.3.
- No schema/contract changes; no scanner changes; no new dependencies (no icon library — text / inline SVG only).
- No Export behavior (Epic 4). No auto-applied patches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Report with `analyst_impacts` ordered [high, high, lower] and matching violations | Metric block: large tabular counts with labels + tinted chips, business-phrase aria-labels. Priority list shows the items in report order — each with `business_problem`, `affected_segment`, `wcag_consequence`, `conversion_impact_estimate` and an accessible "view fix" button | N/A |
| ALL_PASS | Report with zero violations, `analyst_impacts: []` | Counts 0/0/0; restrained conforming empty state ("no critical violations" register) pointing to Developer View; no priority list | N/A |
| MODERATE_MINOR_ONLY | Report with only moderate/minor violations, `analyst_impacts: []` | Counts reflect tiers; same restrained empty state (accurate — nothing critical) pointing to Developer View; no fabricated impacts | N/A |
| CRITICAL_UNTANSLATED | Report with critical/serious violations but `analyst_impacts: []` (translate not run/failed — the wiring deferral case) | Metric figures show the critical counts; NO "No critical violations detected." line (false-clean register is banned); restrained "impact analysis unavailable — see the Developer view" note; no priority list | N/A |
| VIEW_FIX_TOGGLE | "view fix" pressed on any item | Audience switches to Developer instantly and **persists to `sessionStorage`** (same stickiness as the toggle); zero fetch; no auto-scroll; button was focusable/keyboard-operable with `h-11`; the Developer toggle's `aria-pressed` flips to true | N/A |
| BUSINESS_REGISTER | Any populated report | Impact copy uses the report's hedged wording verbatim; zero rule IDs / `helpUrl` / selectors; no injected certainty tokens | N/A |
| NO_RESCAN | Any report, any toggle/view-fix | Rendering and every interaction perform zero `fetch` calls or data callbacks | N/A |
| NARROW_VIEWPORT | Any report at phone width | Cards wrap/stack; toggle reachable; nothing hidden (flex-wrap/stack, never `display:none`) | N/A |

## Code Map

- `apps/web/lib/severity.ts` -- move the pure `countTiers`/`TierCounts` helpers here from `report-surface.tsx` so the header count chips and the Client View metric block read one frozen mapper (3.3 reuses it for the Developer table). `severityTier` stays untouched. Add a shared count-phrase helper (`countPhrase(count, tier)`) used by both the metric figures and `healthFor` so "N critical issue(s)" can never drift between the two surfaces.
- `apps/web/components/client-view.tsx` (new) -- client component `{ report: AuditReport; onViewFix: (violationId: string) => void }`. Renders the executive metric block (large tabular figures + text labels + container-tinted chips + business-phrase `aria-label`s, distinct group label "Executive summary severity counts", in-scale `rounded-lg` tiles) and the priority `<ol>` over `report.analyst_impacts` in order; each item shows the four AnalystImpact fields and a "view fix" button (`h-11`, `focus-visible:outline-2`). Empty state keyed on `counts.critical === 0`; "impact analysis unavailable" note when critical>0 but no impacts.
- `apps/web/components/report-surface.tsx` -- replace the inline `ClientView` placeholder: import the real component, pass `onViewFix` wired to switch the audience AND persist it to `sessionStorage` (shared persist path with the toggle, so the Developer choice stays sticky); keep the Developer placeholder function until 3.3. Header count chips keep using the now-shared `countTiers`/`TIER_CHIP`. Consumer-side tests must assert the DEVELOPER option's `aria-pressed` is true after a view-fix press (the alternate switch path must announce the same active state as a direct toggle press).
- `apps/web/tests/client-view.test.tsx` (new) + targeted additions to `apps/web/tests/report-surface.test.tsx` -- vitest/jsdom/testing-library per existing conventions; fixtures build `AuditReport`/`AnalystImpact` directly (no fetch); cover the I/O matrix + view-fix switch + business-register copy + a11y assertions (`@/` alias imports). Reuse the `countChip` scoped-matcher pattern from `report-surface.test.tsx` (the `{" "}` between number and label is required — see 3.1's dev-loop note).
- `apps/web/app/globals.css` -- no new tokens expected; the 3.1 foundation (severity containers, outline hairlines, `rounded-md` cards, tabular-nums) covers this surface. JetBrains Mono is NOT used in Client View (no code vocabulary).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/lib/severity.ts` -- move shared `countTiers`/`TierCounts`/`TIER_ORDER`/`TIER_LABELS`/`TIER_CHIP` from `report-surface.tsx` + add shared `countPhrase(count, tier)` -- one frozen mapper + one phrase helper for header and Client View.
- [x] `apps/web/components/client-view.tsx` -- executive metric block (large labelled severity figures in tinted chips, distinct group aria-label, in-scale rounding) + priority `<ol>` (AnalystImpact fields verbatim, array order, accessible "view fix") + empty state keyed on `counts.critical === 0` + "impact analysis unavailable" note when critical>0 but no impacts -- FR-9/UXD-7/UXD-14.
- [x] `apps/web/components/report-surface.tsx` -- wire the real `ClientView`; "view fix" → switch audience AND persist to `sessionStorage` (same stickiness as the toggle); keep Developer placeholder -- AC 1, 4.
- [x] `apps/web/tests/client-view.test.tsx` (+ additions to `report-surface.test.tsx`) -- I/O matrix (incl. CRITICAL_UNTANSLATED cross-cell) + a11y + no-rescan + view-fix (persist + `aria-pressed` hand-off + figures pinned tabular/large) + register assertions -- AC 1-5.

**Acceptance Criteria:**
- Given a report in Client View, when I read the summary, then the largest numbers are the severity counts with text labels and container-tinted chips, and the priority list orders the Analyst-ranked remediation items — each with the human problem, affected users, impact statement, and an accessible "view fix" action.
- Given the Client View, then a reader with no axe-core knowledge can state the top three problems and their business impact from this view alone (full copy rendered, nothing truncated or hidden).
- Given the Client View, then impact copy uses the business register and the report's hedge wording — never raw rule IDs or injected certainty — and the empty (all-pass) state renders only when no critical-tier violation is counted, confirms nothing severe was found, and points to the Developer View for full detail (never "All good!"; never a false clean register under visible critical counts).
- Given any report state, then rendering, toggling, and "view fix" cause zero fetch/re-scan/AI calls and no auto-scroll; a view-fix-presumed Developer choice is sticky per session exactly like a toggle press; severity is never conveyed by color alone; interactive elements meet the 3.1 accessibility floor (focusable + labelled, visible focus ring, keyboard-operable, ≥ 44px, no transitions).
- Given a narrow viewport, then the Client View cards wrap/stack with nothing hidden and the toggle stays reachable.

## Spec Change Log

_(Append-only; populated by step-04 review loops.)_

### 2026-08-17 — user approval (Ask First resolutions)

- [x] [Decision] Ask #1 — Extract `ClientView` into a sibling `components/client-view.tsx` and move `countTiers`/`TierCounts` into `lib/severity.ts`: **approved**. Mirrors the 3.3 extraction; header chips consume the same shared mapper.
- [x] [Decision] Ask #2 — Executive-summary block scope: **approved as sheet-strict** — large tabular figures + labels + tinted chips and business-phrase `aria-label`s only. No derived health line beyond the counts (the header's health chip already carries the band; do not duplicate copy).
- Spec status set to `ready-for-dev`; `sprint-status.yaml` 3-2 flipped backlog → ready-for-dev (last_updated 08-17-2026).

### 2026-08-17 — code review loop 1 (bad_spec loopback)

**Verdict by layer:** Blind Hunter — 12 findings; Edge Case Hunter — 5; Verification Gap — 0 gaps + 1 Other finding confirming a live contradiction.

- [x] [Review][bad_spec] D-1 — Empty-state register keyed on `analyst_impacts.length === 0`, not on `counts.critical === 0` — `apps/web/components/client-view.tsx:48`. **Known-bad state avoided:** a raw/untranslated ScanResult reaching the report surface (the wiring-deferral case, so a real path once wiring lands) carries critical/serious violations but an empty `analyst_impacts` array; gating on array presence rendered "No critical violations detected." directly under a "2 Critical" figure — the exact false-clean register the severity fold exists to prevent. Root cause was the spec's Design Note asserting `analyst_impacts empty == no critical findings` (only true when translate always ran) and an I/O matrix missing that cross-cell. **Spec amended (non-frozen sections):** Design Note rewritten to gate the empty state on `counts.critical === 0`; new CRITICAL_UNTANSLATED matrix row defines the "impact analysis unavailable — see the Developer view" note (no conformance claim) for critical>0 + empty impacts; "Always"/AC-3/AC-4 reworded. **KEEP (must survive re-derivation):** shared `countTiers`/`TIER_CHIP` in `lib/severity.ts`; `ClientView` extraction with array-order `<ol>` + all four AnalystImpact fields verbatim + no rule IDs/helpUrl/selectors; accessible `h-11` "view fix" buttons with `focus-visible:outline-2`; "view fix" carries `violation_id` as the 3.3 seam without scroll/focus; business-phrase `aria-label`s; wrap-not-hide responsive; no transitions; `countPhrase` shared helper so "N critical issue(s)" never drifts between metric figures and `healthFor`.
- [x] [Review][Patch] P-1 — View-fix switch bypasses session stickiness (`report-surface.tsx` called `setAudience` directly, so a view-fix-presumed Developer choice was lost on remount — regressing 3.1's STICKY_SESSION capability through this alternate switch path). Spec Code Map/AC updated to require persist through the same `sessionStorage` path as a toggle press + a consumer test asserting the Developer option's `aria-pressed` after a view-fix press.
- [x] [Review][Patch] P-2 — Duplicate accessible name: header chip group and metric block both `role="group" aria-label="Severity counts"`. Spec now pins a distinct metric-block label ("Executive summary severity counts").
- [x] [Review][Patch] P-3 — Metric tiles use `rounded-2xl` outside DESIGN.md's rounding scale. Spec now pins in-scale `rounded-lg` tiles.
- [x] [Review][Patch] P-4 — Metric figures' tabular/large styling (`tabular-nums`, `text-4xl`, `font-bold`) unpinned. Spec's tasks now require tests asserting the figure styling so DESIGN.md's tabular-figures invariant can't silently drop.
- [x] [Review][Reject] R-1 — `countTiers` runs twice per render (report-surface + client-view). Rejected: `AuditReport` is immutable (ADR-4), the two reads cannot diverge, and the duplicate is a trivial pass over a bounded array.
- [x] [Review][Reject] R-2 — Defensive null-guards on `analyst_impacts`/fields. Rejected: the `AuditReport`/`AnalystImpact` TS types and the pushed schema make these fields required; the web tier gains runtime schema validation under the deferred `@darkhouse/contracts` item.
- [x] [Review][Reject] R-3 — Duplicate pluralization logic (`metricPhrase` vs `healthFor`). Rephrased as a rejection-with-fix: folded into the spec (shared `countPhrase` helper) rather than treated as independent noise.
- [x] [Review][Reject] R-4 — Spec change-log wording vs sprint-status drift. Rejected: the approval entry is an accurate historical record at write time; the subsequent status moves are tracked by `sprint-status.yaml`.
- [x] [Review][Defer] W-1 — Focus drops to `<body>` after view-fix (ClientView unmounts). Deferred to 3.3 where the focus target is the real Developer row; recorded in `deferred-work.md`.
- [x] [Review][Defer] W-2 — `timestamp` is optional in `contracts/audit-report.schema.json` but required in the web `AuditReport` TS type, and `formatScanDate(null)` would render "Jan 1, 1970". Pre-existing; recorded in `deferred-work.md`.

**Resolution:** code reverted to baseline (`5223bdc`); spec amended per above; `review_loop_iteration` 0 → 1; re-deriving via step-03. Verification before revert: `pnpm test` 139/139, lint clean, build OK.

### 2026-08-17 — code review loop 2 (patch pass)

**Verdict by layer:** Blind Hunter — 15 findings; Edge Case Hunter — 5; Verification Gap — 0 gaps + 2 Other test-hardening findings. No intent_gap/bad_spec survived triage (the analyst_impacts ↔ violations contract from spec-2.1 makes partial-coverage and `!hasCritical && hasImpacts` unreachable report states — every high-severity violation gets exactly one block and unknown/duplicate ids are dropped, so `analyst_impacts` non-empty always implies a critical-tier count ≥ 1; those findings are rejected as noise). One finding duplicates the loop-1 W-1 defer (focus drop after view-fix — already recorded in `deferred-work.md`). Patches below auto-applied via re-engaged implementation subagent; no revert.

- [x] [Review][Patch] P-5 — `report-surface.tsx` `handleViewFix()` drops the `violation_id` the spec's thread carries from the button: the "callback carries the item's `violation_id` — the 3.3 targeting seam" must stay live through the consumer, not die at the boundary. Fix: accept `(violationId: string)` and retain it in surface state so the 3.3 seam is real; keep switch+persist behavior. Consumer test asserts the pressed id is captured.
- [x] [Review][Patch] P-6 — All N "view fix" buttons share the accessible name "View fix"; distinguishable names required for the list. Fix: per-button accessible name includes the item (e.g. `aria-label={View fix for ${business_problem}}`, visible text unchanged at "View fix"); test name matchers updated accordingly.
- [x] [Review][Patch] P-7 — Priority container's ordered-list semantics unpinned: `client-view.test.tsx` asserts `listitem`s but never that the container is an `<ol>`, so a regresion to `<ul>` stays green while losing ranked semantics the spec pins. Fix: assert the container `tagName === "OL"`.
- [x] [Review][Patch] P-8 — The "no auto-scroll (banned interaction)" constraint has no direct assertion; jsdom's `window.scrollTo` no-ops silently and `Element.prototype.scrollIntoView` is undefined, so a scroll regression ships undetected. Fix: stub `window.scrollTo`/`scrollIntoView` and assert untouched in the view-fix test (mirror the NO_RESCAN fetch-stub pattern).
- [x] [Review][Patch] P-9 — `report-surface.test.tsx` hardcodes the storage key literal `"darkhouse:audience"` instead of the exported `AUDIENCE_STORAGE_KEY`, so a key rename breaks silently. Fix: import and use the constant.
- [x] [Review][Patch] P-10 — Fixture builders duplicated and drifted between `report-surface.test.tsx` (`helpUrl: null`, `analyst_impacts: []` then mutated) and `client-view.test.tsx` (Deque `helpUrl`, impacts as constructor param). Fix: extract a shared `apps/web/tests/fixtures.ts` used by both suites, aligned on the schema shape.
- [x] [Review][Reject] — Priority list must re-sort by severity: rejected, the array IS the Analyst's ranking and the spec pins array order in/array order out (contradicts Always "No re-sorting").
- [x] [Review][Reject] — `analyst_impacts`/violation reconciliation (dup ids, dangling ids): rejected, 2.1 drops duplicates/unknowns and emits exactly one block per high-severity violation; schema makes the fields required.
- [x] [Review][Reject] — Partial-coverage "impact analysis unavailable" for a subset of untranslated criticals: rejected, the Analyst emits complete coverage of high-severity on any successful run and empties on failure; partial states are unreachable.
- [x] [Review][Reject] — Missing fourth render branch (`!hasCritical && hasImpacts`): rejected, contract-unreachable (impacts non-empty ⇒ critical-tier count ≥ 1).
- [x] [Review][Reject] — `analyst_impacts` field present-but-empty-string value guards (blank `dt`/`dd`): rejected, schema enforces non-empty strings and 2.1 forbids placeholder text.
- [x] [Review][Reject] — "Executive summary" shows no indication business prose is pending: rejected, conflicts with the approved sheet-strict Ask #2 (figures + labels only); prose lives in "Priority issues" (2.1 impacts).
- [x] [Review][Reject] — Health-chip band asymmetry (moderate/minor branches don't use `countPhrase`): rejected, those are band labels ("Moderate issues"), not count phrases; the count-phrase register is the metric figures + critical band, and the health chip wording is 3.1-owned and already pinned in `report-surface.test.tsx`.
- [x] [Review][Reject] — Metric figures aria-hidden + group re-declares via `aria-label`: rejected, that is UX-DR12's mandated pattern (business-phrase SR label over the tinted chip with visible text "12"); `countPhrase` is the single source so the label can't drift.
- [x] [Review][Reject] — Narrow-viewport test checks classes not behavior: rejected, jsdom cannot compute real layout; class-based wrap/stack assertions mirror 3.1's approach and the spec's NARROW_VIEWPORT row.
- [x] [Review][Reject] — CRITICAL_UNTANSLATED test name "misleading": rejected, it matches the I/O-matrix row name exactly and the suite does exercise mixed-impact formatting in HAPPY_PATH.
- [x] [Review][Reject] — CRLF/line-ending noise: reject, environment artifact (core.autocrlf on Windows).

**Resolution:** loop review passed with patches only (no revert). `review_loop_iteration` stays 1 (loopbacks only). Re-engaged implementation subagent applied P-5…P-10; full verification re-run below.

## Design Notes

- **The list is a pure render of a pre-ranked contract.** 2.1 already orders `analyst_impacts` highest-business-impact-first with a deterministic tiebreak; re-sorting here would fight both the model's signal and AC-3 determinism. Array order in, array order out.
- **Empty-state gate is `counts.critical === 0`, never `analyst_impacts` presence.** 2.1 returns an empty array made-no-AI-call only for zero critical/serious violations at translate time, but the surface must not assume every report passed through a successful translate (the wiring deferral means raw/untranslated ScanResults can reach a report with critical/serious violations and empty `analyst_impacts`). Gating the "No critical violations detected." register on `analyst_impacts.length === 0` would print that line under a "2 Critical" figure — the exact false-clean register the severity fold exists to prevent. So: the empty-state register renders only when no critical-tier violation is counted; a report with critical/serious violations but no impacts shows the metric figures plus an accurate, restrained "impact analysis unavailable — see the Developer view" note that never claims conformance.
- **"view fix" carries the item's `violation_id`** even though 3.2 only switches the audience — it is the single piece of state 3.3 needs to focus the matching Developer-Vector row, so the seam is designed now and filled later.
- **Reduce Motion and the banned auto-scroll are free:** introduce no transition/animation classes and no view-targeting behavior anywhere.
- **Tabular figures** use `font-variant-numeric: tabular-nums` per DESIGN.md so severity counts don't shimmer between metric states.
- **No mono in Client View.** Business register is Inter-only; JetBrains Mono (rule IDs, selectors) is Developer View vocabulary and stays out (the self-audit reads surface text, not the token sheet).

## Verification

**Commands:**
- `pnpm --filter @darkhouse/web test` -- expected: new `client-view` suites green alongside the existing (~127) tests.
- `pnpm --filter @darkhouse/web lint` -- expected: clean.
- `pnpm --filter @darkhouse/web build` -- expected: succeeds under Next 16 Turbopack.

**Manual checks (if no CLI):**
- The surface is verified by tests only (no route, matching 3.1). For visual sanity, temporarily mount a fixture `AuditReport` on a scratch page and confirm the metric block + priority list render in the established palette and wrap cleanly in `pnpm dev`.

## Suggested Review Order

**Client View component — the heart of this change**

- Entry point: proving 2.1's pre-ranked impacts render array-order-in/array-order-out as a real business summary
  [`client-view.tsx:18`](../../apps/web/components/client-view.tsx#L18)

- Metric block: large tabular figures + text labels in container-tinted chips with business-phrase SR labels (UX-DR12), distinct group name, in-scale `rounded-lg`
  [`client-view.tsx:32`](../../apps/web/components/client-view.tsx#L32)

- Empty-state gate keyed on `counts.critical === 0` — the loop-1 fix that bans the false-clean register under visible critical counts
  [`client-view.tsx:55`](../../apps/web/components/client-view.tsx#L55)

- "Impact analysis unavailable" note for critical>0 with empty `analyst_impacts` (CRITICAL_UNTANGLATED)
  [`client-view.tsx:60`](../../apps/web/components/client-view.tsx#L60)

- Priority `<ol>` in report order with all four AnalystImpact fields verbatim; each item's "view fix" carries the 3.3-targeting `violation_id` and a distinct accessible name
  [`client-view.tsx:66`](../../apps/web/components/client-view.tsx#L66)

**Shared severity mapping**

- One frozen tier mapper moved out of the header so both surfaces read it (3.3 reuses it)
  [`severity.ts:41`](../../apps/web/lib/severity.ts#L41)

- Shared `countPhrase` — "N critical issue(s)" can never drift between metric figures and the health chip
  [`severity.ts:49`](../../apps/web/lib/severity.ts#L49)

**Surface wiring and the view-fix seam**

- `handleViewFix` retains the pressed violation_id in state (the 3.3 seam made real), then persists + switches exactly like a toggle
  [`report-surface.tsx:58`](../../apps/web/components/report-surface.tsx#L58)

- The audience gate swaps ClientView ↔ the 3.1 Developer placeholder
  [`report-surface.tsx:119`](../../apps/web/components/report-surface.tsx#L119)

- `persistAudience` exported so the alternate switch path shares the toggle's sessionStorage stickiness
  [`audience-toggle.tsx:29`](../../apps/web/components/audience-toggle.tsx#L29)

**Tests (peripheral)**

- I/O matrix incl. the false-clean-register cross-cell and the banned-autoscroll assertion
  [`client-view.test.tsx:125`](../../apps/web/tests/client-view.test.tsx#L125)

- View-fix: aria-pressed hand-off + persistence + retained id seam
  [`report-surface.test.tsx:113`](../../apps/web/tests/report-surface.test.tsx#L113)
  [`report-surface.test.tsx:132`](../../apps/web/tests/report-surface.test.tsx#L132)

- Shared fixtures (P-10) so the two suites can't drift their report shapes again
  [`fixtures.ts:14`](../../apps/web/tests/fixtures.ts#L14)