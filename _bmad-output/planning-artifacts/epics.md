---
stepsCompleted: [prerequisites-validated, requirements-extracted, template-initialized, requirements-confirmed, epics-approved, stories-generated, validation-complete]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-darkhouse-2026-08-12/prd.md
  - _bmad-output/planning-artifacts/architecture/architecture-darkhouse-2026-08-12/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-darkhouse-2026-08-12/EXPERIENCE.md
---

# darkhouse - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for darkhouse, decomposing the requirements from the PRD, UX Design, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

- FR-1: A user can submit a public URL to start a Scan, which runs headless and returns the normalized Audit Report data.
- FR-2: The Scan waits for single-page-app content to render before running axe-core against the DOM.
- FR-3: Each Scan returns Core Web Vitals (LCP, INP, CLS) measured from the same page load, merged into the Audit Report.
- FR-4: For each high-severity Violation, the Analyst Agent produces a business-impact explanation: the human-facing failure, affected user segment, WCAG consequence, and a reasoned conversion/compliance impact estimate.
- FR-5: The Analyst Agent orders Violations into a prioritized remediation list, highest business impact first, for both Audience Views.
- FR-6: The Architect Agent produces a proposed Patch (diff + rationale) for each prioritized Violation targeting the affected component.
- FR-7: Developer View renders each Patch as a line-by-line diff with before/after and a visible "proposed, not applied" status.
- FR-8: A single control switches the dashboard between Client View and Developer View over the same Audit Report, without re-running the Scan.
- FR-9: Client View renders the Analyst business impacts, remediation priority, and a high-level health summary in business terms.
- FR-10: Developer View renders Violations with rule IDs, WCAG references, affected nodes, Core Web Vitals, and the reviewable Patches.
- FR-11: A user can export a Scan's Audit Report as a visual, shareable Diagnostic Report file.
- FR-12: The exported Diagnostic Report includes visual proof of at least one high-priority broken experience.

### NonFunctional Requirements

- NFR-1: A Scan must complete with a bounded resource profile (bounded headless instances, bounded timeout) so parallel Scans stay within a modest local machine's budget.
- NFR-2: A Scan completes within the configured timeout; the dashboard loads an existing Audit Report without blocking on any AI call.
- NFR-3: A failed Scan is retryable and returns a typed failure; the AI translation layer degrades gracefully if a free-tier provider is rate-limited.
- NFR-4: AI layer uses free-tier providers only; Scan parallelization is bounded so a full run happens on a local machine at zero recurring cost.
- NFR-5: Each Scan records pipeline stage timings (scan → translate → render) so the pipeline's cost/latency is visible.
- NFR-6: Patches are proposed, never auto-applied (product invariant).
- NFR-7: Public pages only; no user credentials or session data stored.
- NFR-8: Severity is never conveyed by color alone — each severity has a text label and/or icon (self-referential WCAG bar).
- NFR-9: Dashboard usable by a non-technical stakeholder on a laptop without instruction; responsive on mobile (read-only acceptable).

### Additional Requirements

- ADR-1: pnpm workspace monorepo: `apps/web` (Next.js tier), `services/scanner` (Python), `contracts/` (shared schemas). Dependency direction web→contracts, scanner→contracts; web and scanner communicate only over HTTP.
- ADR-2: Python service is a stateless HTTP filter exposing `POST /scan` → `ScanResult`; no business state, no storage.
- ADR-3: One canonical `AuditReport` JSON Schema in `contracts/` with `schemaVersion` mandatory; both Python and TS validate from it.
- ADR-4: Reports immutable; re-scan produces a new `scanId`; `scanId` = ULID.
- ADR-5: Analyst and Architect personas are separate modules emitting `status: proposed` Patch blocks; no auto-apply path in either language.
- ADR-6: AI personas use an OpenAI-compatible interface; provider/model in env config (`A11Y_AI_PROVIDER`, `A11Y_AI_MODEL`, `A11Y_AI_KEY`).
- ADR-7: Pipeline stage timestamps logged for observability.
- ADR-8: Error envelope convention: `{ code, message, stage }`.

### UX Design Requirements

- UX-DR1: Implement the design token foundation from DESIGN.md: semantic color tokens (surface, on-surface, primary indigo, severity: critical/moderate/minor/success, code-surface), Inter + JetBrains Mono typography tokens, 4px-based spacing scale, rounded scale, elevation conventions.
- UX-DR2: Implement the severity chip components: critical/moderate/minor with container-tinted pills and mandatory text label (never color-alone).
- UX-DR3: Implement the Client/Developer segmented toggle (audience toggle): pill control, indigo-active, instant switch with no data reload, sticky per session.
- UX-DR4: Implement the Scan form: URL input with inline (non-toast) validation on malformed URL; submit starts pipeline immediately.
- UX-DR5: Implement the Scan progress surface: three named stages (Scanning → Translating → Ready); unrecoverable stage shows failed state with Retry + cause hint; rate-limit pause state distinct from hard failure.
- UX-DR6: Implement the Report header: URL, scan date, overall health chip, severity counts, Export button; never color-only status.
- UX-DR7: Implement the Client View priority list: Analyst-ranked remediation items with human problem, affected users, impact statement, and "view fix" action that toggles to Developer View at that violation.
- UX-DR8: Implement the Developer View violation table: selector (mono), rule ID chip, WCAG ref chip, severity, inline expansion; sortable columns (not paginated).
- UX-DR9: Implement the Diff/Review panel: always-dark surface, monospace, +/-/∈ line gutter, proposed status badge, line reflow at 150% zoom, copy button, no apply-to-code action.
- UX-DR10: Implement the Export dialog: one-click produces Diagnostic Report file, inline error on failure with retry, success confirms file path/name.
- UX-DR11: Implement empty states: "No scans yet" on Home; restrained all-pass state on Report that guides to Developer View.
- UX-DR12: Implement the accessibility floor: focusable + labeled interactive elements, focus ring visible, keyboard operable full report, Reduce Motion instant transitions, ≥44px touch targets, screen-reader labels using business phrase (`aria-label="12 critical issues"`).
- UX-DR13: Implement the dashboard's responsive behavior: desktop full grid with two-column Developer View; tablet single-column; mobile read-only with no hidden functionality.
- UX-DR14: Enforce the dual-register Voice and Tone via microcopy: Client View plain business language, Developer View exact rule IDs, estimate-hedging ("plausibly," "may") in impact language.

### FR Coverage Map

FR-1: Epic 1 - Scan a public URL headlessly (harvest)
FR-2: Epic 1 - Wait for SPA render before axe-core extraction
FR-3: Epic 1 - Capture Core Web Vitals in the audit
FR-4: Epic 2 - Analyst produces plain-English business impact per violation
FR-5: Epic 2 - Analyst ranks remediation priorities
FR-6: Epic 2 - Architect generates proposed React/Tailwind patches
FR-7: Epic 2 - Patches render as reviewable diffs (proposed, not applied)
FR-8: Epic 3 - Toggle between Client and Developer views
FR-9: Epic 3 - Client View visual business summary
FR-10: Epic 3 - Developer View with rule IDs, vitals, and diffs
FR-11: Epic 4 - Export the Audit Report as a Diagnostic Report
FR-12: Epic 4 - Include visual broken-experience proof in export

## Epic List

### Epic 1: Run a Site Audit
Scan any public URL and get back structured accessibility violations + Core Web Vitals.
**FRs covered:** FR-1, FR-2, FR-3

### Epic 2: Understand & Fix (AI Translation)
Get plain-English business impacts (Analyst) and reviewable React/Tailwind patches (Architect) for the scan.
**FRs covered:** FR-4, FR-5, FR-6, FR-7

### Epic 3: Review the Audit (Dual-Audience Dashboard)
Toggle between client-ready business summary and developer-facing technical detail.
**FRs covered:** FR-8, FR-9, FR-10

### Epic 4: Package & Share (Outreach Reports)
Export a visual Diagnostic Report with broken-experience proof for client delivery and lead-gen.
**FRs covered:** FR-11, FR-12

<!-- Repeat for each epic in epics_list (N = 1, 2, 3...) -->

## Epic 1: Run a Site Audit

Scan any public URL and get back structured accessibility violations + Core Web Vitals.

### Story 1.1: Capture a structured scan of a public URL

As a Nerezo developer,
I want to submit a public URL and receive the raw normalized audit data,
So that I have machine-readable findings before any interpretation.

**Acceptance Criteria:**

**Given** a valid `https://` URL
**When** it is submitted to the scan API
**Then** a ScanResult envelope is returned containing violations and vitals, validated against the shared `contracts/` JSON Schema with `schemaVersion` present
**And** a malformed or non-`https://` URL is rejected with a typed `{ code, message, stage }` error before any headless browser launches
**And** an unreachable host returns a typed failure, never an unhandled exception

Covers: FR-1, ADR-1, ADR-2, ADR-3, ADR-8

### Story 1.2: Harvest the DOM with SPA-render awareness

As a user,
I want axe-core to run only after the page has actually rendered,
So that later-rendered content is audited instead of a shell.

**Acceptance Criteria:**

**Given** a test SPA with deferred-rendered content
**When** the scan runs and axe-core analyzes the DOM
**Then** violations in later-rendered nodes are captured
**And** the scan either completes within the configured timeout or returns a typed timeout status — it never hangs indefinitely

Covers: FR-2, NFR-2

### Story 1.3: Capture Core Web Vitals in the audit

As a user,
I want LCP, INP, and CLS from the same page load merged into the report,
So that accessibility and performance are audited together.

**Acceptance Criteria:**

**Given** a completed scan
**When** the ScanResult is assembled
**Then** a `vitals` block is present, keyed by the same `scanId` as the violations
**And** the harness never exceeds the bounded headless-instance and timeout budget for parallel local runs

Covers: FR-3, NFR-1

### Story 1.4: Submit a scan from the web and watch progress

As a user,
I want to enter a URL in the dashboard and see the pipeline stages,
So that I am not staring at a blank screen during a long scan.

**Acceptance Criteria:**

**Given** the Home surface
**When** I submit a URL
**Then** the scan validates inline (never a toast), starts immediately, and shows the named stages Scanning → Translating → Ready
**And** an unrecoverable stage shows a failed state with a Retry action and a cause hint, distinct from a rate-limit pause which shows "Translation is waiting on a free-tier limit — retrying."
**And** the Home empty state reads "No scans yet — paste a URL to run your first audit."

Covers: FR-1, UXD-4, UXD-5, UXD-11

## Epic 2: Understand & Fix (AI Translation)

Get plain-English business impacts (Analyst) and reviewable React/Tailwind patches (Architect) for the scan.

### Story 2.1: Translate violations into business impact (Analyst persona)

As a non-technical stakeholder,
I want the Analyst persona to explain what each failure means for my business,
So that I can justify spending on the fix.

**Acceptance Criteria:**

**Given** a ScanResult with high-severity violations
**When** the Analyst persona processes it
**Then** every high-severity violation carries a business-impact block: human-facing failure, affected user segment, WCAG consequence, and a reasoned conversion/compliance estimate
**And** each block cites its source violation ID and WCAG reference, and impact estimates use hedging language "plausibly" / "may" / "roughly" (never false certainty)
**And** violations are ranked highest-business-impact-first into a remediation priority list, stable across identical inputs
**And** the persona resolves its provider/model from configuration (`A11Y_AI_PROVIDER`, `A11Y_AI_MODEL`, `A11Y_AI_KEY`) and records pipeline stage timings

Covers: FR-4, FR-5, ADR-6, ADR-7, UXD-14 (estimation hedging)

### Story 2.2: Generate proposed React/Tailwind patches (Architect persona)

As a developer,
I want the Architect persona to produce a concrete fix for each prioritized violation,
So that I do not hand-author every remediation.

**Acceptance Criteria:**

**Given** a prioritized violation list
**When** the Architect persona generates patches
**Then** each patch contains a machine-readable diff, a rationale referencing the violation ID and WCAG rule, and carries `status: proposed`
**And** no code path in either tier applies a patch to any repository — auto-apply is structurally impossible, not just discouraged
**And** the persona is provider-agnostic via configuration with free-tier defaults

Covers: FR-6, ADR-5, ADR-6

### Story 2.3: Render patches as reviewable diffs

As a developer,
I want to review each proposed patch line-by-line against a "proposed, not applied" status,
So that I never merge an unexamined AI change.

**Acceptance Criteria:**

**Given** an AuditReport containing architect patches
**When** I open a patch in the diff viewer
**Then** it renders on the always-dark surface in monospace with a `+/-/ ` gutter, a visible Proposed (not applied) badge, and a copy action
**And** the diff reflows without horizontal clipping at 150% zoom
**And** no apply-to-code control exists in the UI

Covers: FR-7, UXD-9, NFR-6, NFR-8

## Epic 3: Review the Audit (Dual-Audience Dashboard)

Toggle between client-ready business summary and developer-facing technical detail.

### Story 3.1: Establish the design foundation and report surface

As a user,
I want a single report surface with the audience toggle atop a real design system,
So that both audiences read the same audit differently without a new scan.

**Acceptance Criteria:**

**Given** an existing AuditReport
**When** the report surface loads
**Then** it renders the report header (URL, scan date, health chip, severity counts, Export button) without re-running the scan and without blocking on any AI call
**And** the Client/Developer segmented toggle switches views instantly, is sticky per session, and never re-scans
**And** the design token foundation (Indigo/slate/severity semantic palette, Inter + JetBrains Mono, 4px spacing, rounded scale) is in effect across both views
**And** interactive elements are focusable and labeled, focus ring visible, keyboard-operable, instant under Reduce Motion, and severity is never conveyed by color alone
**And** the surface is responsive: full grid desktop, single-column tablet, degraded-density read-only mobile with nothing hidden

Covers: FR-8, NFR-2, NFR-8, NFR-9, UXD-1, UXD-3, UXD-6, UXD-11, UXD-12, UXD-13

### Story 3.2: Render the Client View business summary

As a non-technical client,
I want a visual, business-first summary with a remediation priority list,
So that I understand the problems and their business cost without decoding rule IDs.

**Acceptance Criteria:**

**Given** a report in Client View
**When** I read the summary
**Then** the largest numbers are the severity counts with text labels and container-tinted chips, and the priority list orders Analyst-ranked remediation items each with the human problem, affected users, impact statement, and a "view fix" action
**And** a reader with no axe-core knowledge can state the top three problems and their business impact from this view alone
**And** impact copy uses the business register and estimate hedging, never raw rule IDs or "All good!" overclaiming
**And** the empty (all-pass) state is restrained — it confirms the check found nothing severe and points to the Developer View for full detail

Covers: FR-9, UXD-2, UXD-7, UXD-14

### Story 3.3: Render the Developer View technical detail

As a developer,
I want rule IDs, WCAG references, vitals, and diffs in a sortable table,
So that I can work the long tail of issues efficiently.

**Acceptance Criteria:**

**Given** a report in Developer View
**When** I use the violation table
**Then** rows show the selector in mono, rule ID chip, WCAG ref chip, severity, with inline expansion and sortable columns (not paginated)
**And** every violation shown in the Client View has a technical counterpart reachable here
**And** Core Web Vitals are visible in this view
**And** each high-severity row links to its proposed patch review panel from Story 2.3

Covers: FR-10, UXD-8

## Epic 4: Package & Share (Outreach Reports)

Export a visual Diagnostic Report with broken-experience proof for client delivery and lead-gen.

### Story 4.1: Export the Audit Report as a Diagnostic Report

As a Nerezo developer,
I want to export an audit as a shareable visual file,
So that I can attach a polished deliverable to client outreach without rework.

**Acceptance Criteria:**

**Given** an existing AuditReport
**When** I choose Export from the report header
**Then** the export produces a standalone visual file (no dev server required) containing the Client View summary, priority list, and analyst impacts, without re-scanning
**And** the export dialog errors inline with a retry on failure and confirms the file path/name on success

Covers: FR-11, UXD-10, NFR-2 (loads without AI call)

### Story 4.2: Include broken-experience proof in the export

As a Nerezo developer,
I want the Diagnostic Report to carry visual proof of a high-priority broken experience,
So that outreach emails substitute showing for telling.

**Acceptance Criteria:**

**Given** a scan containing at least one high-severity violation
**When** the report is exported
**Then** the export includes a proof artifact for at least one high-priority failure
**And** an export of a scan with zero high-severity violations still succeeds, omitting the proof section rather than failing

Covers: FR-12