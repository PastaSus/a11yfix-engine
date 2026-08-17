---
title: '4-1: Export the Audit Report as a Diagnostic Report'
type: 'feature'
created: '2026-08-20'
status: 'ready-for-dev'
baseline_commit: '3d8f8ad9c604ca9b2b310e1f8b31b4c942b1ed39'
review_loop_iteration: 0
context:
  - '_bmad-output/planning-artifacts/ux-designs/ux-a11yfix-engine-2026-08-12/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-a11yfix-engine-2026-08-12/EXPERIENCE.md'
  - '_bmad-output/implementation-artifacts/spec-3-2-render-the-client-view-business-summary.md'
  - '_bmad-output/implementation-artifacts/epic-3-context.md'
---

## Intent

**Problem:** The report surface (3.1) ships an "Export report" button (line 101 of `report-surface.tsx`) that is an inert placeholder — a no-op click. A non-technical stakeholder (Priya) or a developer (Dan) cannot produce a standalone visual artifact from the audit to attach to an email, share in Slack, or print. FR-11 requires a shareable Diagnostic Report file. UX-DR10 specifies one-click production, inline error with retry, and success confirmation. Story 4.2 adds visual proof to the export; 4-1 delivers the base export flow.

**Approach:** Replace the inert Export button with a functional export that generates a self-contained HTML file entirely client-side — no fetch, no API route, no server dependency (the "no dev server required" invariant). The export function reads the `AuditReport` already in component state, composes a complete HTML document with embedded CSS (design tokens inlined, Inter font imported from Google Fonts CDN, JetBrains Mono for code), and triggers a browser download via `URL.createObjectURL`. The generated file reuses the same visual structure and data the Client View already renders: severity metric block, priority list (AnalystImpact fields verbatim), scan metadata. Success briefly shows the downloaded filename before resetting; errors show an inline message with a retry affordance. The `ReportSurface` orchestrates the export; a pure `renderReportHtml(report)` function in a new `lib/export.ts` owns the HTML composition and is independently testable.

## Boundaries & Constraints

**Always:**
- The export produces a self-contained HTML file: every style the rendered report needs is embedded in the file (no external stylesheets, no Tailwind build, no CDN fonts except Google Fonts for Inter/JetBrains Mono which are optional offline fallbacks). The file opens in any modern browser with no server.
- The export function reads only the `AuditReport` already in component state — zero `fetch` calls, zero re-scans, zero AI calls. The "no dev server required" invariant holds.
- The file name carries the domain and scan date for discoverability: `a11yfix-report-{hostname}-{YYYY-MM-DD}.html`.
- Success state briefly shows the downloaded filename (e.g. "Downloaded a11yfix-report-example-com-2026-08-20.html") before resetting to the default "Export report" label — a quiet confirmation, not a toast.
- Error state shows an inline error message with a retry button; the original Export button stays visible and functional (no modal, no dead end). "Never silently half-export" (UX-DR7/77).
- The generated HTML mirrors the Client View's data register: severity counts with labels, priority list in Analyst-ranked order with all four `AnalystImpact` fields, no rule IDs or helpUrls (those are Developer View vocabulary). The export is the Client View as a file.
- All interactive elements in the export flow meet the 3.1 accessibility floor: focusable, labelled, visible focus ring, keyboard-operable, ≥ 44px, no transitions (Reduce Motion).
- The `renderReportHtml` pure function is in `lib/export.ts` and is independently unit-testable (no React, no DOM dependencies beyond the generated string).

**Ask First:**
- Whether the exported file's severity count block should replicate the exact `aria-label` / tinted-chip markup from `client-view.tsx` (accessible in the generated HTML) or use a simplified presentation (static text labels with color, since the file is viewed in a browser, not rendered to screen reader in this form).
- Whether a print stylesheet should be added to the generated HTML so `Ctrl+P` produces a clean printout (a natural "diagnostic report" affordance), or if this is deferred to a later story.

**Never:**
- No route, API endpoint, or server-side rendering in 4-1; the export is entirely client-side.
- No PDF generation (no `window.print()` automation, no Puppeteer, no external PDF library); 4-1 ships HTML only. PDF is a future enhancement.
- No broken-experience proof (screenshot, visual artifact) in this story — that is story 4.2's scope. The export includes the data, not the proof.
- No new npm dependencies. `renderToStaticMarkup` from `react-dom/server` is available as a project dependency; if used, it runs client-side to compose the HTML string from existing React components. Otherwise, plain template literals with the AuditReport data.
- No auto-applied patches in the export. NFR-6 holds for files as it does for the UI.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Report with violations, analyst_impacts, architect_patches, vitals populated | Clicking Export produces `a11yfix-report-{domain}-{date}.html` containing: severity counts with labels, priority list with all four AnalystImpact fields, scan date, URL, health label; button briefly shows "Downloaded …" then resets | N/A |
| ALL_PASS | Report with zero violations, `analyst_impacts: []` | Export produces a valid file with 0/0/0 severity counts, restrained "No critical violations" register, scan metadata; no priority list section (empty array) | N/A |
| NO_IMPACTS | Report with critical violations but `analyst_impacts: []` (translate not run) | Export produces a valid file with severity counts, "Impact analysis unavailable" note, no priority list; no fabricated impacts | N/A |
| BLOB_FAILURE | Blob creation throws (theoretical, extremely rare) | Button shows inline error message "Export failed — please try again" with a retry button; original Export button stays functional | Inline error + retry |
| EXPORT_SUCCESS | Any report | Button text changes to "Downloaded {filename}" for ~2 seconds, then resets to "Export report" | N/A |
| FILE_NAME | Any report | File name is `a11yfix-report-{hostname}-{YYYY-MM-DD}.html` where hostname is extracted from `report.url` and date from `report.timestamp` | N/A |
| NO_RESCAN | Any report, any export interaction | Zero fetch calls, zero re-scans, zero AI calls during the entire export flow | N/A |
| KEYBOARD | Any report | Export button is keyboard-operable, focusable with visible ring, labelled | N/A |
| NARROW_VIEWPORT | Any report at phone width | Export button stays reachable; button text truncates gracefully if filename is long | N/A |

## Code Map

- `apps/web/lib/export.ts` (new) — pure `renderReportHtml(report: AuditReport): string` function. Composes a complete standalone HTML document with: embedded CSS (design tokens from globals.css inlined as custom properties, Inter font import, JetBrains Mono for code sections, severity color classes, layout utilities), a `<header>` with URL and scan date, the severity metric block (large tabular figures with labels, tinted containers, business-phrase `aria-label`s), the priority `<ol>` (all four AnalystImpact fields verbatim, array order), and the health summary. Also exports `triggerExport(html: string, filename: string): void` which creates a Blob, object URL, anchor click, and revoke. Pure string functions — no React, no DOM mutation beyond the download trigger.
- `apps/web/components/report-surface.tsx` — replace the inert Export button (line 97–102) with a controlled export flow: `exportState: "idle" | "success" | "error"` drives the button label and error display. `handleExport` calls `renderReportHtml(report)`, then `triggerExport`, catches errors, and manages the success/error state transitions. Passes `report` through to the export function.
- `apps/web/tests/export.test.ts` (new) — unit tests for `renderReportHtml`: returns valid HTML string containing expected sections (severity block, priority list, scan metadata); handles all-pass (zero violations), no-impacts, and happy-path inputs; file name derivation. Unit tests for `triggerExport`: creates Blob, calls `createElement`/`click`/`revokeObjectURL`.
- `apps/web/tests/report-surface.test.tsx` — additions for the export flow: clicking Export triggers download; success shows filename; error shows retry; no fetch calls during export; button remains accessible.
- `apps/web/app/globals.css` — no changes; the embedded export CSS inlines the token values from `:root` (lines 3–31).

## Tasks & Acceptance

**Execution:**
- [ ] `apps/web/lib/export.ts` — new `renderReportHtml(report)` composing standalone HTML with embedded CSS (design tokens, Inter import, severity colors, layout), severity metric block, priority list, scan metadata + `triggerExport(html, filename)` for Blob download — FR-11/UX-DR10.
- [ ] `apps/web/components/report-surface.tsx` — replace inert Export button with controlled export flow (`exportState` + `handleExport` calling `renderReportHtml`/`triggerExport`); success shows filename briefly; error shows inline retry; button stays functional and accessible — AC 1, 4.
- [ ] `apps/web/tests/export.test.ts` — unit tests for `renderReportHtml` (HTML output, all-pass, no-impacts, happy-path sections) and `triggerExport` (Blob, click, revoke) — AC 1–5.
- [ ] `apps/web/tests/report-surface.test.tsx` — additions: export triggers download, success confirmation, error retry, no fetch, keyboard accessible — AC 4–5.

**Acceptance Criteria:**
- Given a report in Client View, when I click Export, then a standalone HTML file is downloaded containing the severity counts with labels, the priority list with all four AnalystImpact fields in Analyst-ranked order, the scan date, URL, and health label — with zero fetch/re-scan/AI calls.
- Given the exported file, when opened in a browser with no server, then all styling is present (embedded CSS, no external stylesheets), the severity counts are visible with text labels, and the priority list renders the full business-problem / affected-segment / wcag-consequence / conversion-impact-estimate text for each item.
- Given any report state (all-pass, no-impacts, happy path), when I click Export, then a valid HTML file is produced that accurately reflects the data — "No critical violations" register when zero critical; "Impact analysis unavailable" note when critical>0 with empty impacts; no fabricated data.
- Given any export interaction, when I observe the flow, then the Export button shows a brief success confirmation with the downloaded filename (~2 seconds) before resetting, or on error shows an inline message with a retry button; the button remains focusable, labelled, and keyboard-operable at all times.
- Given a narrow viewport, then the Export button stays reachable and its text truncates gracefully if the filename is long.

## Spec Change Log

_(Append-only; populated by step-04 review loops.)_

## Design Notes

- **Client-side-only generation is a product constraint, not a shortcut.** The "no dev server required" invariant (FR-11) means the exported file must open locally without `pnpm dev`. Server-side rendering or API-driven export would couple the file to the running app. Client-side HTML composition with embedded CSS ensures the file is truly standalone.
- **Embedded CSS reuses the design token values, not the Tailwind classes.** The exported HTML is a static document — Tailwind's utility classes won't resolve without the build pipeline. Instead, the CSS custom properties from `globals.css :root` are inlined, and minimal layout/color classes are hand-written for the report structure. Inter is imported from Google Fonts CDN; if offline, the browser falls back to its default sans-serif.
- **The success confirmation is a quiet inline label, not a toast.** UX-DR7 bans toast-flooding; the "Downloaded {filename}" text briefly replaces the button label, then resets. This is the lightest-weight confirmation that doesn't interrupt the user's flow.
- **File naming carries the domain and date.** `a11yfix-report-example-com-2026-08-20.html` is immediately identifiable in a Downloads folder. The hostname is extracted from `report.url` (browser `URL` API); the date from `report.timestamp` formatted as ISO date.
- **No PDF in 4-1.** HTML is universally viewable, shareable, and printable. PDF adds complexity (puppeteer, print styles, encoding) that belongs in a later story if demanded. The spec can be extended; the base export is HTML.
- **4.2's proof artifact is explicitly out of scope.** The export contains data (counts, impacts, metadata) but not screenshots or visual proof of broken experiences. That coupling is story 4.2's design problem.

## Verification

**Commands:**
- `pnpm --filter @a11yfix/web test` — expected: new `export` suites green alongside the existing (~169) tests.
- `pnpm --filter @a11yfix/web lint` — expected: clean.
- `pnpm --filter @a11yfix/web build` — expected: succeeds under Next 16 Turbopack.

**Manual checks (if no CLI):**
- Mount a fixture `AuditReport` on a scratch page, click Export, and confirm the downloaded HTML opens correctly in a browser with all styling present and no external resource errors.

## Suggested Review Order

**Export function — the core logic**

- Entry point: pure HTML generation from AuditReport
  `lib/export.ts` (new)

- Standalone HTML output: embedded CSS, severity block, priority list, metadata
  `lib/export.ts` — renderReportHtml

- Download trigger: Blob → object URL → anchor click → revoke
  `lib/export.ts` — triggerExport

**Surface wiring**

- Export button replaces inert placeholder; manages success/error state transitions
  `report-surface.tsx:97` — the Export button

**Tests (peripheral)**

- HTML output correctness (all-pass, no-impacts, happy path), trigger mechanics
  `export.test.ts` (new)

- Consumer-side: export flow, success confirmation, error retry, no fetch, keyboard
  `report-surface.test.tsx` — additions
