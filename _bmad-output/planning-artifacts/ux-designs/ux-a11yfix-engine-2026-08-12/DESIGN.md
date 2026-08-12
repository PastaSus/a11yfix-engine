---
name: A11yFix Engine
status: draft
sources:
  - {planning_artifacts}/prds/prd-a11yfix-engine-2026-08-12/prd.md
  - {planning_artifacts}/briefs/brief-a11yfix-engine-2026-08-12/brief.md
created: 2026-08-12
updated: 2026-08-12
colors:
  surface: '#f8fafc'
  surface-container: '#f1f5f9'
  surface-container-high: '#e2e8f0'
  on-surface: '#0f172a'
  on-surface-variant: '#475569'
  outline: '#94a3b8'
  primary: '#4338ca'
  on-primary: '#ffffff'
  primary-container: '#e0e7ff'
  on-primary-container: '#312e81'
  secondary: '#0f766e'
  on-secondary: '#ffffff'
  secondary-container: '#ccfbf1'
  on-secondary-container: '#134e4a'
  error: '#b91c1c'
  on-error: '#ffffff'
  error-container: '#fee2e2'
  on-error-container: '#7f1d1d'
  warning: '#b45309'
  on-warning: '#ffffff'
  warning-container: '#fef3c7'
  on-warning-container: '#78350f'
  success: '#15803d'
  on-success: '#ffffff'
  success-container: '#dcfce7'
  on-success-container: '#14532d'
  code-surface: '#0f172a'
  code-on-surface: '#e2e8f0'
typography:
  display:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.15'
    letterSpacing: -0.02em
  headline:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: '1.3'
  body:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sans:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1.4'
    letterSpacing: '0.04em'
  mono:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '400'
    lineHeight: '1.6'
rounded:
  sm: 0.25rem
  DEFAULT: 0.375rem
  md: 0.5rem
  lg: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 48px
---

## Brand & Style

A11yFix Engine presents as **Instrumental Precision**: a clinical, trustworthy tool interface that earns attention through restraint rather than decoration. The product's subject matter — accessibility and performance — demands credibility; the visual language answers with a quiet, engineering-grade confidence that suits both a business stakeholder making a budget decision and a developer reviewing a diff.

The register is **calm authority**. It avoids both the "left-panel enterprise gray" cliché and the "viral startup gradient" noise of consumer tools. Emphasis lands through semantic color and typographic hierarchy, never ornament.

## Colors

- **Slate (`#0f172a`)** is the ink on `surface` — text, active states, primary structure. Slate-based palette keeps the tool feeling technical without feeling cold.
- **Indigo (`#4338ca`)** is the single brand accent — primary actions, active navigation, the "A11yFix" identity anchor. One accent, used sparingly.
- **Teal (`#0f766e`)** is the **pass / conforming** semantic — passed checks, applied patch confirmation. Distinct from indigo so "actionable" and "healthy" are never confused.
- **Red (`#b91c1c`)** is **critical severity** — high-severity violations, failures. Always paired with text, never color-only.
- **Amber (`#b45309`)** is **moderate severity** — medium-severity violations, warnings, in-progress states.
- **Green (`#15803d`)** in `success-container` pairs with teal for pass states inside tables and export flows.
- **Code surfaces are dark (`#0f172a`)** regardless of the surrounding theme — the diff viewer is always dark-on-dark for line-level focus, matching developer-tool convention. `[ASSUMPTION: The diff view is always dark]`.
- All semantic pairs meet WCAG AA on-text contrast on their containers; severity is never communicated by hue alone (always with a label). Self-referential — the product that audits contrast must not fail its own bar.

## Typography

- **Inter** for all UI text. Weights are purposeful: `700` display (headline values like "12 critical"), `600` headline (report reference / priority titles), `400` body. Inter is default system-adjacent and ships free with Tailwind `[ASSUMPTION: Inter installed as a Tailwind font token]`.
- **JetBrains Mono** for all code: diffs, rule IDs, affected-node selectors, vitals values. Mono instantly signals "technical, exact" — the Developer View's native tongue.
- Numbers in score displays use `font-variant-numeric: tabular-nums` so metrics align in tables and don't shimmer between metric states.
- Labels are set small (`12px`), semibold, tracked-out — the quiet dashboard-expert voice.

## Layout & Spacing

- **12-column grid on desktop**, single column mobile. The dashboard's content zone is bounded to a readable measure (~1040px content max) with generous side gutters — a report reads like a document, not a fishbowl.
- **4px spacing unit** scaled up: 16px in tight clusters (tables, metric chips), 24px between report sections, 48px page margins on desktop. Density is data-first: more information per screen for developers, more whitespace per section for the business summary view.
- The two Audience Views share the same grid but differ in pacing: Client View uses larger type and section gaps; Developer View tightens the same grid for density. `[ASSUMPTION: single layout system, two density modes]`.

## Elevation & Depth

- **Flat with subtle layering**, no heavy shadows. Surfaces are separated by `surface-container` tints and 1px `outline` borders, not by floating cards.
- The only elevation: the **diff/export panel** and the **audience toggle bar** sit on `surface-container-high` with a 1px outline — a deliberate "working surface" affordance.
- Patches and violation rows use hairline dividers (`outline` at 1px), letting the report breathe without boxes-on-boxes.

## Shapes

- **Small rounding throughout** — `rounded-DEFAULT` (0.25rem) for chips and inline elements, `rounded-md` (0.5rem) for cards and panels, `rounded-full` only for pill toggles and stat chips. The shape language reads "precision instrument," not "friendly consumer app."
- Code blocks use `rounded-sm` — the diff is text first; gentle corners keep it from feeling like a modal.

## Components

- **Buttons:** primary `#4338ca`/white; secondary outline (`outline` border, `on-surface` text); ghost text-only for table actions. Focus ring is `outline-2 + offset` in indigo, always visible.
- **Cards/panels:** `surface` fill, 1px `outline` hairline, `rounded-md`. Used for violation groups, metric cards, patch review.
- **Metric cards:** icon (semantic container color) + tabular number (`display`) + label. Severity-colored container only as a tinted chip, never full-bleed.
- **Code/diff viewer:** always-dark surface, mono text, red/green/gray per changed line, `+/-/ ` gutter. Line numbers muted. One logical change per block, wrap at 100 chars.
- **Chips/tags:** rule IDs (`mono`), severity, WCAG references, patch status. `rounded-full` pills with container tints.
- **Toggle (Client/Developer):** pill segmented control, top of every report; active segment indigo-filled, inactive ghost. Fills the dual-audience promise visually.
- **Tables:** header `label` caps on `surface-container`, row dividers hairline, tabular numbers, sortable columns indicated by caret `[ASSUMPTION: sortable violation tables]`.
- **Navigation:** top bar — product name/logo (indigo square mark), primary nav, view toggle contextually; no sidebar in v1 `[ASSUMPTION: single top bar, no sidebar]`.

## Do's and Don'ts

| Do | Don't |
|---|---|
| Use red/amber only for severity semantics, always with a text label | Communicate severity by hue alone |
| Keep the diff viewer dark in every theme | Invert diff colors or theme the code surface |
| Let whitespace carry the Client View | Fill Client View with density meant for developers |
| Use one brand accent (indigo) | Rainbow accents per feature |
| Show numbers tabular and metric | Animate numbers or add decorative hero graphics |

**.working/color-themes:** skipped on fast path — palette fixed by semantic needs above (severity states are data, not taste) `[ASSUMPTION]`.