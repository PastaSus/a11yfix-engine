# Epic 3 Context: Review the Audit (Dual-Audience Dashboard)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Present the immutable AuditReport produced by Epics 1–2 on a single report surface paired with a Client/Developer audience toggle, so both audiences read the same audit differently without ever re-running a scan. The Client View is a business-first visual summary — severity counts with labels, a health chip, and the Analyst-ranked remediation priority list with plain-English impacts — while the Developer View is the technical long tail: rule IDs, WCAG references, selectors, vitals, and links into the proposed-patch diff panel. This epic also establishes the design token foundation (Indigo/slate/severity semantic palette, Inter + JetBrains Mono, 4px spacing, rounded scale) that later surfaces (Epic 4 export) inherit.

## Stories

- Story 3.1: Establish the design foundation and report surface
- Story 3.2: Render the Client View business summary
- Story 3.3: Render the Developer View technical detail

## Requirements & Constraints

- The report surface renders the report header (URL, scan date, health chip, severity counts, Export button) from an existing AuditReport without blocking on any AI call or triggering a new scan; the toggle must also never re-scan.
- Toggle is a segmented Client/Developer control present on every report page, switches views instantly, and is sticky per session.
- Client and Developer views must not diverge: every violation shown in Client View has a technical counterpart reachable in Developer View.
- A reader with no axe-core knowledge can state the top three problems and their business impact from the Client View alone.
- Client View impact copy uses the business register with estimate hedging — never raw rule IDs, and never "All good!" overclaiming. The all-pass empty state is restrained, confirms nothing severe was found, and points to Developer View for full detail.
- Developer View shows a sortable (never paginated) violation table with inline expansion, Core Web Vitals, and per-row links from high-severity violations to the patch review panel.
- Accessibility floor: interactive elements are focusable and label role + state, focus ring visible, fully keyboard-operable, instant under Reduce Motion, touch targets ≥ 44px, diff reflows without horizontal clipping at 150% zoom. Severity is never conveyed by color alone; semantic pairs meet WCAG AA on-text contrast on their containers.
- Responsive: full grid desktop, single-column tablet, degraded-density read-only mobile with nothing hidden (missing features on mobile are flag-and-not-hide, not removed).

## Technical Decisions

- Present stage lives in the Next.js tier (dashboard) and reads the immutable AuditReport; toggling changes rendering only, never data or pipeline state. Reports are immutable — no in-place mutation, re-scans produce a new `scanId` (ULID) — and both tiers validate against the shared `contracts/` schema (`schemaVersion` mandatory). Severity vocabulary is fixed at critical / moderate / minor; error envelope is `{ code, message, stage }`.
- Design tokens are defined via Tailwind v4 `@theme inline` in `globals.css` (not `tailwind.config.js`): Indigo `#4338ca` as the single brand accent; Slate `#0f172a` ink; Teal pass/conforming, Red critical, Amber moderate, Green success-container — each semantic color paired with a text label. Inter for UI text (weights 700/600/400 purposeful); JetBrains Mono for all code (rule IDs, selectors, vitals, diffs); tabular-nums on score displays. 4px spacing unit scaled up; small rounding scale (`rounded` chips, `rounded-md` cards/panels, `rounded-full` pill toggles and stat chips). Code/diff surfaces are always dark regardless of theme.
- One layout system, two density modes: a 12-column desktop grid bounded to a ~1040px reading measure; Client View is airy with larger type and section gaps, Developer View tightens the same grid. Navigation is a single top bar (no sidebar in v1); report surfaces stack one level deep, so violation detail is inline expansion, not a nested page.
- Toggle state is sticky per session (client-side, assumed — no persistence backend); default landing view is Client View.

## UX & Interaction Patterns

- Report header: URL, scan date, overall health chip, severity counts, Export button — status is never color-only; skeleton loading keeps the header (URL, date) rendered first.
- Client View: severity counter uses large tabular numbers with text labels and container-tinted chips; the priority list orders Analyst-ranked items, each showing the human problem, affected users, impact, and a "view fix" action that switches to Developer View at that violation.
- Developer View: violation rows show mono selector, rule ID chip, WCAG ref chip, severity, expandable inline detail, and sortable columns (caret indicator); buttons span primary (indigo), secondary outline, and ghost text-only for table actions.
- Banned interaction: auto-scroll on toggle (views map 1:1 to sections), modals stacked deeper than one, celebratory animations, toast-flooding, carousels, confetti.
- Screen-reader labels on metric values use the business phrase (e.g. `aria-label="12 critical issues"`), not raw rule lemmas. Impact microcopy hedges with "plausibly"/"may"/"roughly".

## Cross-Story Dependencies

- Consumes the enriched AuditReport: Epic 1 ScanResult (vitals + violations) and Epic 2 Analyst impacts (priority list for 3.2) and Architect patches (diff-panel links for 3.3).
- 3.3's high-severity rows link to Story 2.3's patch review panel; 3.2's "view fix" action toggles to 3.3's view at the matching violation.
- 3.1's design token foundation and report header (tokens, palette, header pattern) are the shared base Epic 4's export reuses; the header Export button hands off to the export flow.