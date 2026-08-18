---
title: '3-3: Render the Developer View (technical detail)'
type: 'feature'
created: '2026-08-18'
status: 'done'
baseline_commit: '9a5fe88d77878f438860504a50f8188bb22c47f8'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/EXPERIENCE.md'
  - '_bmad-output/implementation-artifacts/spec-3-1-establish-the-design-foundation-and-report-surface.md'
  - '_bmad-output/implementation-artifacts/spec-3-2-render-the-client-view-business-summary.md'
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
---

## Intent

**Problem:** The report surface (3.1) ships its Developer View as three placeholder cards — "Violations", "Core Web Vitals", and "Proposed fixes" — that currently read "land here in a later release." The `AuditReport` prop carries every piece the Developer View needs: `violations` (rule IDs, impact, affected nodes), `vitals` (LCP, INP, CLS), and `architect_patches` (unified diffs with WCAG rule references and rationale). A developer still cannot inspect a specific violation, review a proposed patch, or assess performance from the report alone — which is the Developer half of the dual-audience design (FR-10, UX-DR8).

**Approach:** Replace the three Developer View placeholders with the real technical detail: (1) a sortable violation table whose rows show the rule ID (mono), severity chip, affected-node count, and an expandable inline detail section with `description` and `helpUrl` link; (2) a Core Web Vitals panel displaying LCP, INP, and CLS as labelled metric cards with the same tinted-chip pattern from the Client View's severity block; and (3) a proposed-fixes section rendering each `ArchitectPatch` via the existing `DiffViewer` component with the patch's `rationale` and `wcag_rule` displayed alongside. The `data-pending-view-fix` seam from 3.2 must honor the violation ID: when a "view fix" press switches to Developer View, the matching violation row is scrolled to and focused. Reads only the passed `AuditReport` — no fetch, no re-scan, no AI, no route — matching 3.1's standalone-module seam. Extracted into its own component (`developer-view.tsx`) mirroring 3.2's `client-view.tsx` extraction.

## Boundaries & Constraints

**Always:**
- The surface consumes only data already in the passed `AuditReport` — no fetch, no re-scan, no AI/translate call, no back-end work, no route/navigation.
- The violation table renders all violations from `report.violations` — every violation shown in Client View has a technical counterpart reachable here (FR-10). Rows are sortable by column (severity, rule ID, node count) via clickable column headers; default sort is severity descending (critical → serious → moderate → minor), matching the Client View's priority ordering.
- Each violation row shows: rule ID (JetBrains Mono), severity chip (text label + container tint, never color-only per UX-DR12), affected-node count (`nodes.length`), and an expandable inline detail section that reveals the full `description` text and a `helpUrl` link when present.
- The Core Web Vitals panel displays `report.vitals` as three metric cards (LCP, INP, CLS) with large tabular figures, text labels, and unit suffixes (ms for LCP/INP, unitless for CLS). Null values display "—" with an appropriate screen-reader label (e.g. `aria-label="INP: not measured"`).
- The proposed-fixes section iterates `report.architect_patches` in array order. Each patch renders via the existing `DiffViewer` component plus the patch's `rationale` text and `wcag_rule` chip. When `architect_patches` is empty, a restrained "No patches generated" note renders.
- The `data-pending-view-fix` attribute on the root `<section>` (set by 3.2's `handleViewFix`) is consumed: on mount or when the attribute changes, the matching violation row (by `violation_id`) is scrolled into view and receives focus. Auto-scroll is banned by 3.2's constraint; this is an intentional, single, user-initiated focus move — the one exception to the no-auto-scroll rule, triggered by a explicit "view fix" action.
- Severity is never conveyed by color alone — every severity chip pairs a container tint with a visible text label (UX-DR12). The violation table's severity column uses the same `TIER_CHIP` classes from `lib/severity.ts`.
- Interactive elements: focusable, labelled, visible `focus-visible` ring (tokenized), fully keyboard-operable, touch targets ≥ 44px (`h-11`), **no transitions** (Reduce Motion).
- Responsive: violation table scrolls horizontally on narrow viewports (never truncated); vitals and patches stack; toggle stays reachable. Nothing hidden.

**Ask First:**
- Whether the violation table should show the `helpUrl` as a full inline link ("Learn more at axe") or as a compact icon-button — the spec pins a text link for accessibility but the visual treatment is flexible.
- Whether the vitals panel should render a derived "health" label per metric (e.g. "Good" / "Needs improvement" based on CWV thresholds) or stay strictly figures-only like the Client View's severity block (approved as sheet-strict in 3.2 Ask #2).

**Never:**
- No route, persistence, navigation, or API call in 3.3; the wiring deferral recorded in `deferred-work.md` stands.
- No re-sorting/rewriting of `architect_patches` array order — patches render in the order the Architect emitted them.
- No auto-scroll ban exception beyond the single `data-pending-view-fix` focus move triggered by an explicit "view fix" action. All other rendering and toggling perform zero scroll behavior.
- No schema/contract changes; no scanner changes; no new dependencies (no icon library — text / inline SVG only).
- No Export behavior (Epic 4). No auto-applied patches.
- No patch application, merge, or code-edit affordance — `DiffViewer` is read-only and stays that way (NFR-6).

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Report with violations across critical/serious/moderate/minor, vitals populated, architect patches present | Violation table: rows with rule ID (mono), severity chip (text + tint), node count, expandable description/helpUrl. Vitals: three metric cards with values. Patches: DiffViewer per patch with rationale + wcag_rule chip | N/A |
| NO_VIOLATIONS | Report with zero violations, empty `architect_patches` | Violation table shows empty state ("No violations detected"); vitals still render; patches show "No generated patches" | N/A |
| NO_PATCHES | Report with violations but empty `architect_patches` | Violation table and vitals render normally; patches section shows "No generated patches" note | N/A |
| NULL_VITALS | Report with null LCP/INP/CLS values | Metric cards display "—" with `aria-label` indicating "not measured" (e.g. `aria-label="LCP: not measured"`) | N/A |
| VIEW_FIX_FOCUS | "view fix" pressed in Client View, switches to Developer | Violation row matching `violation_id` receives focus (scrollIntoView + focus); no other auto-scroll | N/A |
| SORT_BY_SEVERITY | User clicks severity column header | Rows reorder by severity descending (default) or ascending (toggle); sort is stable for equal severity | N/A |
| SORT_BY_RULE | User clicks rule ID column header | Rows reorder alphabetically by rule ID; stable sort | N/A |
| SORT_BY_NODES | User clicks node count column header | Rows reorder by affected-node count descending; stable sort | N/A |
| INLINE_EXPAND | User clicks a violation row | Row expands inline revealing full `description` text and `helpUrl` link (when present); expansion is instant, no transition | N/A |
| NARROW_VIEWPORT | Any report at phone width | Table scrolls horizontally; vitals and patches stack; toggle reachable; nothing hidden | N/A |
| NO_RESCAN | Any report, any interaction | Rendering, sorting, expanding, and toggling perform zero `fetch` calls or data callbacks | N/A |

## Code Map

- `apps/web/components/developer-view.tsx` (new) — client component `{ report: AuditReport; pendingViewFix: string | null }`. Renders the violation table (sortable, expandable rows), vitals panel (three metric cards), and proposed-fixes section (DiffViewer per patch). Consumes `data-pending-view-fix` to focus the matching row on mount/attribute change.
- `apps/web/components/report-surface.tsx` — replace the inline `DeveloperView` placeholder (lines 129–152) with an import of the real `developer-view.tsx` component, passing `report` and `pendingViewFix` state. The audience gate at line 119 already swaps between Client and Developer; the Developer slot receives the real component.
- `apps/web/lib/severity.ts` — no changes; `TIER_CHIP`, `TIER_ORDER`, `TIER_LABELS`, `severityTier`, `countTiers`, `countPhrase` are consumed as-is by the violation table's severity column.
- `apps/web/components/diff-viewer.tsx` — consumed as-is; no modifications. The `DiffViewer` component renders each `ArchitectPatch` in the proposed-fixes section.
- `apps/web/tests/developer-view.test.tsx` (new) + targeted additions to `apps/web/tests/report-surface.test.tsx` — vitest/jsdom/testing-library per existing conventions; fixtures build `AuditReport`/`Violation`/`ArchitectPatch` directly (no fetch); cover the I/O matrix + sorting + inline expansion + view-fix focus + a11y assertions (`@/` alias imports).
- `apps/web/tests/fixtures.ts` — extend `makeViolation` to accept an optional `nodes` array (default empty) and add a `makePatch` helper for `ArchitectPatch` fixtures. Extend `makeReport` to accept optional `architect_patches` parameter.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/tests/fixtures.ts` — extend `makeViolation` with optional `nodes` param; add `makePatch(diff?, fields?)` helper returning `ArchitectPatch`; extend `makeReport` to accept optional `architect_patches`.
- [x] `apps/web/components/developer-view.tsx` — new component: violation table (sortable by severity/rule/nodes, expandable rows with description + helpUrl), vitals panel (LCP/INP/CLS metric cards, null → "—"), proposed-fixes section (DiffViewer per patch with rationale + wcag_rule), empty states for no-violations/no-patches, `data-pending-view-fix` focus logic — FR-10/UX-DR8/UX-DR9.
- [x] `apps/web/components/report-surface.tsx` — replace the inline `DeveloperView` placeholder with import of real `DeveloperView`; pass `report` and `pendingViewFix` state.
- [x] `apps/web/tests/developer-view.test.tsx` (+ additions to `report-surface.test.tsx`) — I/O matrix + sorting + inline expansion + view-fix focus + vitals null handling + empty states + a11y assertions (focusable + labelled, visible focus ring, keyboard-operable, no transitions, ≥ 44px touch targets) + no-rescan + responsive wrap.

**Acceptance Criteria:**
- Given a report in Developer View, when I use the violation table, then rows show the rule ID in mono, a severity chip with text label and container tint, and the affected-node count — and clicking a row expands it inline to reveal the full description and a helpUrl link (when present).
- Given the Developer View, when I click a column header (severity, rule ID, node count), then the rows reorder by that column in a stable sort; the default sort is severity descending.
- Given the Developer View, then Core Web Vitals are visible as three labelled metric cards (LCP in ms, INP in ms, CLS unitless) with large tabular figures; null values show "—" with a screen-reader "not measured" label.
- Given the Developer View, then each `ArchitectPatch` renders via `DiffViewer` with the patch's `rationale` and `wcag_rule` visible; when no patches exist, a restrained "No generated patches" note renders.
- Given any report state, then rendering, sorting, expanding, and toggling cause zero `fetch`/re-scan/AI calls; a view-fix press focuses the matching violation row (scrollIntoView + focus) without other auto-scroll; severity is never color-only; interactive elements meet the 3.1 accessibility floor (focusable + labelled, visible focus ring, keyboard-operable, ≥ 44px, no transitions).
- Given a narrow viewport, then the violation table scrolls horizontally (never truncated), vitals and patches stack, and the toggle stays reachable with nothing hidden.

## Spec Change Log

_(Append-only; populated by step-04 review loops.)_

### 2026-08-19 — code review loop 1 (patch pass)

**Verdict by layer:** Blind Hunter — 13 findings; Edge Case Hunter — 2; Verification Gap — 1 real gap. No intent_gap/bad_spec survived triage. Rejected: affected-node detail (spec pins count-only; no selector field in the `Violation` type), DiffViewer-internal test coupling (deliberate a11y sweep), no-match `pendingViewFix` (contract-unreachable — 2.1 emits one block per existing violation), severity sort = raw impact (spec explicitly names critical→serious→moderate→minor ordering), sort announcement (DESIGN.md caret + `aria-sort` present, no announcement required), string-scan transition test (inherited 3-1 convention), fixture ergonomics (positional args acceptable at this scale), duplicate violation id (axe emits one violation per rule id — ids unique). Patches below auto-applied via re-engaged implementation subagent; no revert.

- [x] [Review][Patch] P-1 — `pendingViewFix` had no lifecycle: set by `handleViewFix` but never cleared, so a view-fix-press stale id re-scrolled/re-focused the row on a later *manual* Developer toggle (focus theft, violating the "single, user-initiated focus move" intent + no-auto-scroll ban). Fix: `DeveloperView` accepts `onPendingConsumed`, calls it after its focus effect, and `ReportSurface` clears the id via a stable callback (`react-hooks/set-state-in-effect` forbids the parent-effect alternative); `data-pending-view-fix` becomes undefined post-consumption (allowed). Tests: `VIEW_FIX_SEAM` now asserts the id is cleared; new `VIEW_FIX_NO_STALE_FOCUS` pins the boundary (manual toggle after view-fix → scrollIntoView stays at 1 call, no row focus) and confirms a genuine second view-fix press re-arms the focus.
- [x] [Review][Patch] P-2 — Scroll stubs leaked across tests: `stubScrollBehaviors()` / inline `Object.defineProperty` on `Element.prototype.scrollIntoView` never restored. Fix: both test files capture the original descriptor at module load and restore it in `afterEach` (deleting the own property when jsdom has no native descriptor).
- [x] [Review][Patch] P-3 — `scrollIntoView({ block: "nearest" })` omitted `behavior`, so a global `scroll-behavior: smooth` would animate (Reduce Motion / no-transitions invariant). Fix: explicit `{ behavior: "instant", block: "nearest" }`; tests assert the exact options object.
- [x] [Review][Patch] P-4 — Focused violation row (`tabIndex={-1}` view-fix target) was not keyboard-operable: `onClick` only, no Enter/Space. Fix: `onKeyDown` on the row toggles `expandedIds` on Enter/Space (`preventDefault` on Space to stop page scroll). New `KEYBOARD_EXPAND` test.
- [x] [Review][Patch] P-5 — Violation table had no accessible name (heading outside `<table>`). Fix: `aria-label="Violations"` on the `<table>`; test asserts `getByRole("table", { name: "Violations" })`.
- [x] [Review][Patch] P-6 — Fixture diff hunk header inconsistent: `@@ -1,6 +1,7 @@` claims 6→7 lines but body has 1 del + 4 adds. Fix: corrected to `@@ -1 +1,4 @@` in both `makePatch` (`fixtures.ts`) and the identical copy in `diff-viewer.test.tsx`.

**Resolution:** loop review passed with patches only (no revert). `review_loop_iteration` stays 0 (loopbacks only). Re-engaged implementation subagent applied P-1…P-6; full verification re-run: `pnpm --filter @darkhouse/web test` 169/169, lint clean, build OK.

## Design Notes

- **The violation table is the technical counterpart to the Client View's priority list.** Every violation rendered in the Client View has a row here; the rule ID, helpUrl, and node detail are Developer-register vocabulary that stays out of the Client View (3.2's business-register constraint).
- **Sorting is a developer affordance, not a re-ranking.** The Client View's priority list is the Analyst's business ranking (array order in, array order out). The Developer View's sort is a standard table interaction — the developer chooses the lens. Default severity-descending keeps the most critical rows at the top, matching the Client View's visual hierarchy.
- **The `data-pending-view-fix` focus move is the one exception to the no-auto-scroll ban.** 3.2's constraint bans auto-scroll on toggle (the two views map 1:1 to sections). The focus move is different: it is triggered by an explicit user action ("view fix" button press), targets a specific element (the matching violation row), and is the designed seam between Client and Developer views (3.2's `violation_id` callback). The focus move uses `scrollIntoView({ block: "nearest" })` + `focus()` — no animation, no `scroll-behavior: smooth`.
- **Null vitals are a real state.** The scanner may fail to measure a metric (timeout, observer never fires — the deferred-work items from 1.3). The Developer View must not fabricate a value or hide the metric; "—" with a screen-reader label is the honest treatment.
- **JetBrains Mono for rule IDs only.** Selectors (if/when the scanner surfaces them) would also use mono, but the current `Violation` type has no `target`/selector field. The rule ID chip is the only mono element in the violation row today.
- **DiffViewer is consumed, not modified.** The existing component handles the always-dark surface, +/-/ gutters, copy-to-clipboard, and the "Proposed — not applied" badge. 3.3 adds the `rationale` and `wcag_rule` as caption text outside the DiffViewer's dark surface.
- **Empty states are restrained and accurate.** "No violations detected" (zero violations) and "No generated patches" (empty patches array) follow the same register as 3.2's empty states — no "All good!" overclaiming, no celebratory copy.

## Verification

**Commands:**
- `pnpm --filter @darkhouse/web test` — expected: new `developer-view` suites green alongside the existing (~139) tests.
- `pnpm --filter @darkhouse/web lint` — expected: clean.
- `pnpm --filter @darkhouse/web build` — expected: succeeds under Next 16 Turbopack.

**Manual checks (if no CLI):**
- The surface is verified by tests only (no route, matching 3.1). For visual sanity, temporarily mount a fixture `AuditReport` with violations, vitals, and patches on a scratch page and confirm the violation table, vitals cards, and diff panels render in the established palette and scroll/expand cleanly in `pnpm dev`.

## Suggested Review Order

**Developer View component — the heart of this change**

- Entry point: sortable table, vitals cards, and diff list replace the 3.1 placeholder
  [`developer-view.tsx:64`](../../apps/web/components/developer-view.tsx#L64)

- View-fix focus, one-shot: consumes `pendingViewFix`, scrolls instantly, then reports consumption so the id clears
  [`developer-view.tsx:107`](../../apps/web/components/developer-view.tsx#L107)

- Violation table: sortable severity/rule/nodes headers with `aria-sort`, keyboard-operable expandable rows
  [`developer-view.tsx:128`](../../apps/web/components/developer-view.tsx#L128)

- Vitals cards: null → "—" with a business-phrase "not measured" SR label, tabular figures
  [`developer-view.tsx:257`](../../apps/web/components/developer-view.tsx#L257)

- Proposed fixes: DiffViewer per patch with `wcag_rule` chip + rationale, restrained empty state
  [`developer-view.tsx:291`](../../apps/web/components/developer-view.tsx#L291)

**Surface wiring and the focus seam**

- `handleViewFix` retains the pressed `violation_id`, then `handlePendingConsumed` clears it after one focus move
  [`report-surface.tsx:59`](../../apps/web/components/report-surface.tsx#L59)

- The audience gate swaps ClientView ↔ the real DeveloperView, passing the pending seam
  [`report-surface.tsx:130`](../../apps/web/components/report-surface.tsx#L130)

**Tests (peripheral)**

- I/O matrix incl. sorting, expansion, null vitals, empty states, and the banned-auto-scroll assertion
  [`developer-view.test.tsx:61`](../../apps/web/tests/developer-view.test.tsx#L61)

- View-fix: one-shot focus seam, no-stale-focus boundary, and a genuine re-arm on a second press
  [`report-surface.test.tsx:164`](../../apps/web/tests/report-surface.test.tsx#L164)

- Shared fixtures: nodes param, `makePatch`, optional `architect_patches`
  [`fixtures.ts:4`](../../apps/web/tests/fixtures.ts#L4)
