---
title: Darkhouse
status: approved
created: 2026-08-12
updated: 2026-08-12
---

# Product Brief: Darkhouse

## Executive Summary

Darkhouse is an automated web accessibility and performance remediation platform that turns raw diagnostic metrics into actionable business outcomes. It closes the gap between the technical failures a scan produces and the decisions a business can act on.

The platform runs a three-stage pipeline. A lightweight Python service drives headless Chromium with Playwright and axe-core to extract DOM-tree accessibility violations alongside Core Web Vitals on any public page. An AI translation layer then processes that output through two distinct specialist personas: an Analyst Agent that converts technical failures into plain-English business impact — what a WCAG compliance gap or poor mobile contrast actually costs in lost conversions — and an Architect Agent that generates production-ready, accessible React and Tailwind CSS code patches for those exact issues. Finally, a Next.js App Router dashboard presents both perspectives, toggleable between a client-ready visual audit and line-by-line developer diffs.

Launched as an open-source project, Darkhouse serves as an enterprise-grade portfolio centerpiece built with disciplined, spec-driven architecture. Internally, it doubles as Nerezo Studio's lead-generation engine: automated prospect site checks, visual diagnostic report exports, and direct proof of broken user experiences attached to outreach emails.

## The Problem

Accessibility and performance remediation is stalled by a translation gap. Developers receive raw axe-core and Core Web Vitals dumps — dense lists of rule IDs, WCAG references, and numeric thresholds — and must manually translate them into meaning. Business stakeholders cannot read those outputs, cannot connect a contrast violation to revenue, and therefore cannot justify the budget to fix it. The result is a well-documented loop: audits get run, reports get filed, and violations persist because nobody can articulate what they cost.

For a studio selling fixes, the problem is also a sales problem. Nerezo outreach relies on telling prospects their site has issues. Telling is weak; showing is strong. There is no streamlined way to run a check on a prospect, produce a visual, exportable report, and attach concrete proof of a broken user experience to an email — the exact artifact that makes a technical conversation a sales conversation.

On the fix side, existing tools tell you *what* is broken but rarely *how to fix it*. Developers are left to hand-craft remediations for every violation, slowing delivery and leaving the long tail of issues unpatched.

## The Solution

Darkhouse is a three-part pipeline, each leg aimed at one failure in the loop above:

1. **Harvest.** A Python service running Playwright + axe-core scans any public URL headlessly, producing a structured report of DOM violations and Core Web Vitals.
2. **Translate.** An AI layer applies two personas to that raw data. The Analyst converts technical failures into quantified business language — "this contrast violation fails WCAG AA on 40% of your product pages and blocks roughly a quarter of your mobile users from completing checkout." The Architect generates concrete, production-ready React and Tailwind patches that resolve the specific violations found.
3. **Present and act.** A Next.js App Router dashboard renders one audit two ways: a high-level visual summary for non-technical clients and line-by-line code diffs for developers. Generated patches are **proposed**, never auto-applied — a human reviews each diff before it touches a codebase, keeping AI fixes safe by construction.

The same engine feeds Nerezo Studio's lead-gen loop. Report exports package a scan as a visual diagnostic deliverable, and the "broken experience proof" view gives outreach emails a concrete artifact to attach.

## What Makes This Different

- **A translation layer, not another linter.** Most tools audit; Darkhouse explains and fixes. The Analyst-to-Architect pairing is the differentiator — business narrative and working code from the same scan.
- **Generated remediations.** Patches for the long tail of issues, not just a findings list. Adoption of fixes, not just awareness, is the product.
- **One audit, two audiences.** A single scan renders for a stakeholder who needs to feel the problem and a developer who needs to fix it — no re-scans, no manual rewrite.
- **Human-in-the-loop by design.** Diffs are proposed and reviewed, an honest and defensible answer to AI-generated accessibility code (wrong ARIA is worse than none).
- **A sales weapon.** Visual, exportable proof-of-broken-UX is built in from day one.
- **Begins free.** Entirely open-source stack — Playwright, axe-core, free-tier AI, Next.js — from first commit to production demo.

## Who This Serves

- **Nerezo Studio (primary).** Runs prospect checks, exports visual reports, and attaches broken-experience proof to outreach. Success for them: more qualified conversations, fewer "we don't have an a11y issue" objections.
- **Solo developers and small shops.** A free, self-hosted way to turn audits into client-facing reports and actionable patches — a credibility multiplier for any freelancer pitching accessibility work.
- **Non-technical stakeholders.** Clients who receive a report they understand, with business impact they can act on.
- **Developers.** Targeted, reviewable fixes instead of a raw violation list.

## Success Criteria

- **Fix velocity:** measurable reduction in scan-to-patch time; a meaningful share of reported violations get a proposed diff.
- **Business impact coverage:** every high-severity violation is explainable in plain-English business terms, not just rule IDs.
- **Adoption signal:** OSS traction (stars, forks, downloads) and at least one complete, third-party documented usage.
- **Nerezo conversion:** tracked outreach emails containing scan-proof artifacts measurably outperform narrative-only outreach.
- **Trust:** zero cases of a proposed patch being applied that worsened the page's accessibility score.

## Scope

**In v1**
- Headless scan of public URLs: WCAG 2.1 A/AA DOM violations + Core Web Vitals.
- Analyst and Architect AI personas over scan output.
- Toggleable dashboard: client visual summary + developer diff view.
- Proposed (non-automated) patch review flow.
- Visual/exportable diagnostic report for outreach.
- Local-first: run the full pipeline for free on a dev machine.

**Explicitly out of v1**
- Auto-applying fixes to live sites.
- Scanning behind login/authentication.
- Multi-tenant SaaS auth, billing, or team accounts.
- Paid AI model tiers; enterprise queue/rate-limit management.
- Deep CI/CD platform integrations (post-v1, part of the vision).

## Vision

If Darkhouse succeeds, remediation stops being a dump-and-forget exercise. A scan becomes a working document a business can act on and a developer can ship from. In two to three years, the spec-driven, two-persona pipeline is the pattern teams reach for when an audit needs to become a fix — with the OSS core remaining free and a thin, optional hosted tier covering secure scans, teams, and CI integration for teams that want it. For Nerezo, it simply becomes the reason prospects pick up the phone.