# Epic 4 Context: Package & Share (Outreach Reports)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Turn a finished audit into a sales-ready, shareable artifact. A user exports an existing AuditReport as a standalone visual Diagnostic Report file — containing the Client View summary, the Analyst-prioritized remediation list, and captured broken-experience proof — so Nerezo can attach a polished deliverable to prospect outreach without rework or a re-scan. This closes the lead-gen loop: a prospect scan becomes visible proof of a broken user experience, attached directly to an outreach email.

## Stories

- Story 4.1: Export the Audit Report as a Diagnostic Report
- Story 4.2: Include broken-experience proof in the export

## Requirements & Constraints

- Export produces a standalone visual file (no dev server required to view it) containing the Client View summary, the remediation priority list, and the Analyst business impacts.
- Export derives from an existing AuditReport; it never re-scans and never blocks on any AI call.
- The export flow is one-click from the report header; failure errors inline with a retry (never a silent half-export), and success confirms the produced file path/name.
- A Diagnostic Report must be producible from a fresh scan in at most two user actions (SM-4).
- When the scan has at least one high-severity violation, the export carries visual proof of at least one high-priority broken experience; no such proof is ever empty.
- An export for a scan with zero high-severity violations still succeeds, omitting the proof section rather than failing.
- What the proof artifact captures (e.g., full-page vs cropped screenshot) is an unsettled open question; the export must tolerate the final format rather than hardcode an assumption about it.

## Technical Decisions

- Export is a Present-stage concern living in the Next.js web tier (`apps/web`), governed by the single-orchestrator pipeline (AD-1) and report immutability (AD-4): the file is a rendering derivation of the immutable AuditReport envelope, never a mutation of it.
- All packaged content — summary, priority list, Analyst impacts, and the source of the proof — comes from data already present in the AuditReport after translation; no new interchange format crosses a tier boundary (AD-3).
- The exported artifact is self-contained so it renders without the dev server or scanner running.

## UX & Interaction Patterns

- Export is reached from the Export button in the report header (alongside URL, scan date, health chip, severity counts).
- The export dialog is one-click; failure shows an inline error with retry, success confirms the file path/name.
- The export is the Client-facing deliverable and uses the Client View register: plain business language, severity counts with text labels, never color-alone, no raw rule IDs required for comprehension. Impact estimate-hedging carries into the export.
- The broken-experience proof is the climax of the outreach flow — showing beats telling in the email.
- Export obeys the banned-behavior list: no confetti or celebratory animation on completion.

## Cross-Story Dependencies

- Story 4.2 builds on 4.1: the proof is included in the export surface that 4.1 produces.
- Both stories depend on Epic 2 output — the export packages Analyst impacts and the ranked priority list.
- Both depend on Epic 3's report surface — the Export button lives in the report header built there.
- The proof's capture source touches the scan pipeline (Epic 1): if it requires scanner-side capture, that must be resolved before the proof artifact can be populated.
