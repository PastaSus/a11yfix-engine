---
name: Darkhouse
status: draft
sources:
  - {planning_artifacts}/prds/prd-darkhouse-2026-08-12/prd.md
  - {planning_artifacts}/briefs/brief-darkhouse-2026-08-12/brief.md
created: 2026-08-12
updated: 2026-08-12
---

# Darkhouse — Experience Spine

> Paired with `DESIGN.md` (this file's sibling). Web dashboard, dual-audience. Two UI modes on one grid: Client View (business narrative) and Developer View (line-level precision). The single product tension this spine resolves: one report, two languages.

## Foundation

Single-surface web dashboard (Next.js App Router + Tailwind, React). No external UI system named — Tailwind primitives + the tokens in `DESIGN.md`. Primary access: desktop browser (laptop) — report reading, diff review, export. Mobile: view-only reading is acceptable; interactive flows (new scan, patch review) are desktop-first `[ASSUMPTION: desktop-first, mobile read-only]`. `DESIGN.md` is the visual identity reference; this spine is the experience.

## Information Architecture

| Surface | Reached from | Purpose | Audience View |
|---|---|---|---|
| Home / New Scan | App open | Enter URL, start a Scan, see recent Scans | Both (recent list is neutral) |
| Scan status | Home, on submit | Live progress: scan → translate → ready | Neutral progress, same for both |
| Audit Report | Recent list tap | The report: severity, impacts, patches | **Both — the toggle lives here** |
| — Client View | Report toggle | Business summary, priority, cost impact | Client |
| — Developer View | Report toggle | Violations, rule IDs, vitals, diffs | Developer |
| Export | Report header | Produce Diagnostic Report file | Client-facing deliverable |
| Settings | Top bar | AI provider select, default severity filter `[ASSUMPTION]` | Neutral |

Top bar navigation: brand mark, "New Scan" primary button, Settings. No sidebar in v1 `[ASSUMPTION]`. Report surfaces stack one level deep; no nested detail pages beyond the report itself — violation *detail* is inline expansion, not a separate page.

→ Composition references: none yet on fast path (mock coverage step pending). Spine wins on conflict.

## Voice and Tone

The product speaks two registers — same brand, different emphasis (microcopy engineering lives here; brand voice/aesthetic lives in `DESIGN.md` Brand & Style).

| Context | Do | Don't |
|---|---|---|
| Client View headline | "12 critical issues across your product pages" | "12 violations, 4 [color-contrast], 3 [aria-*]" |
| Client View impact | "This blocks roughly a quarter of mobile checkout attempts." | "Insufficient contrast ratio on .product-price link." |
| Developer View | Rule IDs, WCAG refs, element selectors, exact diffs | Business soft-pedaling in technical rows |
| Errors | "We couldn't reach that site — it may be down, or the network is slow." | "400 Bad Request" |
| Patch review | "Proposed — not applied. Review before merging." | "Fix generated ✓" |
| Empty result | "No critical violations detected. Check the Developer view for the full report." | "All good!" |

Never claim certainty the Analyst model doesn't have: impact language uses "plausibly," "may," "roughly" for estimates, "conforms"/"fails" only for verified checks `[ASSUMPTION: matches PRD OQ-2 framing]`.

## Component Patterns

Behavioral. Visual specs live in `DESIGN.md.Components`.

| Component | Use | Behavioral rules |
|---|---|---|
| Audience toggle | Report header | Segmented pill; switching is instant (no re-scan, no reload of data). State is sticky per session `[ASSUMPTION]`. |
| Scan form | Home | URL input validates on submit; error inline (not toast) on malformed URL. Submit starts pipeline immediately. |
| Scan progress | Home / status | Three named stages: **Scanning → Translating → Ready**. Unrecoverable stage shows a failed state with a Retry + "what went wrong" hint. |
| Report header | Report top | URL, scan date, overall health chip, severity counts, Export button. Never color-only status. |
| Severity counter | Client View | Large tabular numbers with labels ("Critical / Moderate / Minor") and container-tinted chips. |
| Priority list | Client View | Analyst-ranked remediation list; each item: human problem, affected users, impact, "view fix" → toggles to Developer View at that violation. |
| Violation row | Developer View | Selector (mono), rule ID chip, WCAG ref chip, severity, expandable inline detail. Sortable columns. |
| Diff/Review panel | Developer View | Always-dark surface; proposed status badge visible until accepted-like action; per-line add/remove/context; copy button; no apply-to-code action in v1. |
| Export dialog | Report header | One-click produces Diagnostic Report; success confirms file path/name. |
| Empty state | Home | "No scans yet — paste a URL to run your first audit." |

## State Patterns

| State | Surface | Treatment |
|---|---|---|
| Scan submitted | Home → status | Progress shows stages; cancel allowed during Scan stage only. |
| Scan failed (unreachable/timeout) | Home → status | Typed failure, Retry, underlying cause hint (HTTP, DNS, timeout). Never a generic crash. |
| Translator paused (rate-limited) | Status | "Translation is waiting on a free-tier limit — retrying." Not a hard failure; progress stays visible. |
| Report loading | Report | Skeletons, not spinners; keep the header (URL, date) rendered first. |
| Severity empty (all pass) | Report | Empty state celebrates with restraint, then guides to Developer View for full detail. |
| Patch review | Diff panel | Neutral "Proposed — not applied." No success animation; accept/copy is a quiet confirmation. |
| Offline/failed export | Export dialog | Error inline with retry; never silently half-export. |

## Interaction Primitives

- Tap/click to act. Keyboard-overridable everywhere.
- Reports read top-down; expandable rows for inline detail (no detail-page navigation).
- Sortable, not paginated, violation tables in v1 (single report scale) `[ASSUMPTION]`.
- **Banned:** auto-scroll on toggle (the two views map 1:1 to sections), modal stacks deeper than one, celebratory animations, toast-flooding on status changes, carousels, confetti on export.

## Accessibility Floor

Behavioral. Visual contrast lives in `DESIGN.md`.

- Every interactive element is focusable and labels its role + state. Toggle announces the active view. Focus ring visible on all outline/focusable elements.
- Severity is never conveyed by color alone — each severity has a text label and/or icon `[self-referential invariant: the product must pass its own audit]`.
- Keyboard: full report (rows, diffs, export, toggle) operable without a mouse; focus order follows reading order.
- Reduce Motion: no transitions; toggles and expansions are instant.
- Touch targets ≥ 44px on all interactive affordances (desktop ok, mobile-safe by design).
- Diff text is reflowable and legible at 150% zoom without horizontal clipping.
- Screen-reader labels on metric values use the business phrase, not the raw lemma (`aria-label="12 critical issues"`, text `12`).

## Key Flows

### Flow 1 — Prospect audit to outreach (Matteo at Nerezo)

1. Matteo opens the app, lands on Home.
2. He pastes the prospect URL into the scan form, submits.
3. Progress moves **Scanning → Translating → Ready**; no interaction needed.
4. He opens the report; it defaults to Client View.
5. He reads the Analyst summary and priority list, spot-checks the figures.
6. He taps **Export**, the Diagnostic Report is produced.
7. **Climax:** the export includes the captured broken-experience proof and is ready to attach to the outreach email — a sales-ready artifact in one session.

Failure: the prospect site is unreachable → Mattheo sees the typed failure with a retry and a hint, not a dead end.

### Flow 2 — Client reads the report (Priya, non-technical founder)

1. Priya opens the shared Diagnostic Report or report link.
2. Client View shows a business-language health summary: key numbers with labels, plain-language impact bullets.
3. She scans the priority list; each item names the human problem and its business cost.
4. She finds the top issue and its impact immediately.
5. **Climax:** she can articulate "the checkout problem costs me orders" and forwards the report to her developer — the translation layer did its job.

Edge case: no critical issues → the restrained empty state tells her the check found nothing severe and points to full detail, so a clean audit still reads as work done.

### Flow 3 — Developer reviews and applies (Dan)

1. Dan opens the same report, toggles to Developer View.
2. Violation table lists rule IDs, WCAG refs, selectors; he sorts by severity.
3. He expands a violation; the proposed patch renders as a diff with the "Proposed — not applied" badge.
4. He reviews line-by-line, uses copy, makes his own adjustment in his editor.
5. **Climax:** he has merged a correct, reviewable fix — the Architect saved the hand-authoring time, the review kept it safe.

Edge case: a proposed patch targets markup that doesn't exist in his stack → he dismisses with context (the reason flows to the report), never merged blind.

## Responsive & Platform

- **Desktop (primary):** full grid, inline diffs, two-column report on Developer View, export panel.
- **Tablet:** single column report; diff panel still inline; toggle remains reachable.
- **Mobile:** read-only emphasis. Report readable and exportable; new-scan and patch-intense flows presented but flagged desktop-optimal. No functionality hidden — degraded density, not missing features `[ASSUMPTION]`.
- No PWA/native in v1. Browser-only.