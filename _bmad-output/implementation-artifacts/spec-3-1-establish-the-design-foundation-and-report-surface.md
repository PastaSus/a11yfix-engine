---
title: 'Establish the design foundation and report surface'
type: 'feature'
created: '2026-08-16'
status: 'done'
baseline_commit: '48b1dd47b3ce5a222c2a84434cbb76e4557ea428'
review_loop_iteration: 0
context: ['_bmad-output/planning-artifacts/ux-designs/ux-a11yfix-engine-2026-08-12/DESIGN.md']
---

## Intent

**Problem:** The dashboard has no design system and no report surface. Tokens are a bare default palette, fonts are Geist placeholders (DESIGN.md pin Inter + JetBrains Mono), dark OS schemes only flip background/foreground, and no component renders an AuditReport — so neither audience can read the audit.

**Approach:** Establish the token foundation (Indigo/slate + severity palette, Inter + JetBrains Mono, 4px spacing + rounded scale, `color-scheme`, corrected outline token) and a standalone `ReportSurface` component fed by an `AuditReport` prop: report header (URL, scan date, health chip, severity counts, Export button) over a session-sticky Client/Developer toggle with placeholder view slots. Deliberately not wired to any route — matching Epics 1–2's standalone-module seam (wiring is deferred).

## Boundaries & Constraints

**Always:**
- The surface consumes only data already in the passed `AuditReport` — no fetch, no re-scan, no AI/translate call, no back-end work.
- Toggle switches audience instantly, is sticky per session (`sessionStorage`), and never re-fetches data (banned: auto-scroll on toggle).
- Severity is never conveyed by color alone — health chip and count chips pair color with a text label/icon (product-invariant: the app must pass its own audit).
- Interactive elements: focusable, labelled (`aria-pressed` on the active toggle), visible focus ring, keyboard-operable, touch targets ≥ 44px (match `diff-viewer.tsx` `h-11`), and **no transitions** (Reduce Motion).
- Token foundation lives only in `@theme inline` in `globals.css` + `next/font` vars in `layout.tsx` — never `tailwind.config.js`.
- Code/diff surfaces stay always-dark (`#0f172a`) regardless of theme; `diff-viewer.tsx` is untouched.
- Frozen severity display mapping: axe `critical/serious → Critical`, `moderate → Moderate`, `minor → Minor` (three-tier vocabulary; high band folds).

**Ask First:**
- Any change to the severity fold (`critical+serious → Critical`) — product-facing definition surfaced from the 1.1 vocabulary-drift deferral.
- Wiring the surface into a route/report flow, or adding an icon/component library dependency.

**Never:**
- No route, persistence, navigation, or API call in 3.1; no scanner/`contracts` changes; no schema validation (deferred `@a11yfix/contracts`).
- Do not implement Client View content (summary/priority list — 3.2) or Developer View content (violation table/vitals/diffs — 3.3); 3.1 ships placeholder slots the toggle switches between.
- Do not implement Export behavior (Epic 4): button present + accessible, click is a no-op placeholder.
- No auto-applied patches.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Report with violations across critical/serious/moderate/minor | Header: URL, scan date, health chip text, counts Critical (critical+serious), Moderate, Minor — labelled, never color-only, Export button present | N/A |
| ALL_PASS | Report with zero violations | Counts 0/0/0; health chip shows conforming ("No critical issues" register, no "All good!") | N/A |
| STICKY_SESSION | Toggle set to Developer, surface remounts in same session | Restores Developer from `sessionStorage`; missing/empty value defaults to Client | N/A |
| NO_RESCAN | Any report | Rendering/toggling performs zero `fetch` calls or data callbacks | N/A |

## Code Map

- `apps/web/app/layout.tsx` -- Geist/Geist_Mono via `next/font/google` (lines 5–13); swap to Inter (`--font-inter`) + JetBrains Mono (`--font-jetbrains-mono`), same `variable`+`subsets: ["latin"]` pattern.
- `apps/web/app/globals.css` -- `@theme inline` (lines 8–35) holds 24 tokens: surface family, `--color-primary #4338ca` (Indigo accent), error/warning/success, `--color-outline #94a3b8`, `--font-sans/--font-mono` → geist vars; `body` hardcodes `Arial`. Dark block (37–42) flips only `--background/--foreground`. Tailwind v4 default 4px spacing scale + `rounded/rounded-md/rounded-full` already satisfy the 4px/rounded spec — no work there.
- `apps/web/components/diff-viewer.tsx` -- convention mirror, read-only: always-dark surface (`data-surface="dark"`, `bg-[#0f172a]`, `font-mono`), `h-11` touch targets, `focus-visible:outline-2 focus-visible:outline-offset-2`, `useId` for labelled regions.
- `apps/web/lib/scan.ts` -- `Violation.impact: "critical"|"serious"|"moderate"|"minor"` (line 14); `ScanResult` shape; `submitScan` must NOT be used by the surface.
- `apps/web/lib/translate/client.ts` -- `AuditReport` type (lines 28–37) is the surface's prop type; `AnalystImpact`/`ArchitectPatch` are for 3.2/3.3.
- `apps/web/lib/severity.ts` (new) -- pure `severityTier(impact)` implementing the frozen mapping; reused by 3.2/3.3.
- `apps/web/components/report-surface.tsx` (new) -- client component `{ report: AuditReport }`; renders header + toggle + two placeholder view sections (one grid, one density mode; desktop 12-col bounded to `max-w-[1040px]`, wrap/stack on narrow viewport, nothing hidden).
- `apps/web/components/audience-toggle.tsx` (new) -- segmented Client/Developer control; `role="group"` + two buttons with `aria-pressed`; restore-from-`sessionStorage` in `useEffect` under key `a11yfix:audience` (default Client; avoids hydration mismatch).
- `apps/web/tests/report-surface.test.tsx`, `apps/web/tests/audience-toggle.test.tsx` (new) -- vitest/jsdom/testing-library per `tests/diff-viewer.test.tsx` conventions; fixtures build `AuditReport` directly (no fetch); cover all I/O rows + focus/label/keyboard assertions (`@/` alias imports).
- `apps/web/package.json` -- no icon library installed; plain text or inline SVG only (no new dependency).

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/app/layout.tsx` -- swap Geist → Inter + JetBrains Mono `next/font` vars -- drives `--font-sans/--font-mono`.
- [x] `apps/web/app/globals.css` -- re-point font vars, `body` to `var(--font-sans)`, add severity tokens (critical/moderate/minor + conforming-success, each tinted container + label colour), darken `--color-outline` to pass WCAG 3:1 non-text contrast on `--color-surface` (e.g. slate-500 `#64748b`), add `color-scheme: light`/`dark` + dark variants of surface/text/severity tokens -- closes the spec-1-4 token deferral.
- [x] `apps/web/lib/severity.ts` -- new `severityTier` mapper -- shared discriminator for 3.2/3.3.
- [x] `apps/web/components/audience-toggle.tsx` -- new segmented toggle -- sticky, instant, accessible.
- [x] `apps/web/components/report-surface.tsx` -- new report shell (header + toggle + view slots) -- the 3.1 deliverable.
- [x] `apps/web/tests/audience-toggle.test.tsx` + `apps/web/tests/report-surface.test.tsx` -- I/O matrix + a11y + sticky + no-rescan tests -- AC verification.

**Acceptance Criteria:**
- Given an existing AuditReport, when the surface renders, then the header shows URL, scan date, health chip, severity counts per the frozen mapping, and a labelled Export button — with zero fetch/re-scan/AI calls.
- Given the surface, when I toggle Client↔Developer, then the switch is instant, the active view is announced via `aria-pressed`, the choice persists across mounts in the session, and no data is re-fetched.
- Given either view, then Inter sans, JetBrains Mono code, the Indigo/slate/severity palette, 4px spacing, and rounded scale are in effect via tokens — measurable from `globals.css`, not hard-coded per-component hex.
- Given the rendered surface, when audited, then interactive elements are focusable + labelled with a visible focus ring, fully keyboard-operable, transition-free (Reduce Motion), and severity/health is never color-only.
- Given a narrow viewport, then the header wraps without horizontal overflow, the toggle stays reachable, and nothing is hidden (flex-wrap/stack, never `display:none`).

## Spec Change Log

_(Append-only; populated by step-04 review loops.)_

### 2026-08-16 — code review (48b1dd4..HEAD)

**Verdict by layer:** Blind Hunter — 10 findings; Edge Case Hunter — 5 (1 deletion finding: none); Verification Gap — 3 gaps + 1 other; Acceptance Auditor — ACs 1/2/4/5 pass, AC3 pass-with-note. Verification reproduced this session: `pnpm test` 118/118, `pnpm lint` clean, `pnpm build` OK.

- [x] [Review][Decision] D-1 severityTier has no default for out-of-vocab impacts — `apps/web/lib/severity.ts:5-15` — an unknown `impact` returns `undefined`, so the violation is silently dropped from every tier count and a report that genuinely has a violation can render the conforming health chip ("No critical issues"). The fold is frozen product vocabulary; where an out-of-set value should land (fold to minor/moderate, or surface an unclassified bucket) is an Ask First call. **Resolved 2026-08-16 (decision): fold unknown → moderate; patch applied + unit test added.**
- [x] [Review][Decision] D-2 health chip wording is false for mid/low bands — `apps/web/components/report-surface.tsx:42-53` — `healthFor` returns "Moderate and minor issues" (moderate tone) for any report with counts.moderate>0 OR counts.minor>0, so a minor-only or moderate-only report states a band that is not present. The fix toward accuracy is unambiguous; the correct register/tone (e.g., minor-only → "Minor issues" on conforming) is a product-facing definition the spec does not pin. **Resolved 2026-08-16 (user chose per-band labels + tones); patch applied with coverage for moderate-only / minor-only / both-bands.**
- [x] [Review][Patch] P-1 Page chrome does not consume the token foundation — `apps/web/app/globals.css:108-112` — `body` still reads legacy `--background: #ffffff` / `--foreground: #171717`; the slate ink/surface tokens (`--on-surface: #0f172a`, `--surface: #f8fafc`) are defined but the app's own text/bg are off-palette, so the visible shell is not "Indigo/slate in effect" (AC3 pass-with-note). **Fixed: `body` → `var(--surface)`/`var(--on-surface)`; legacy `--background`/`--foreground` repurposed to slate palette values.**
- [x] [Review][Patch] P-2 `metadata.title` / description are still Create-Next-App scaffold text — `apps/web/app/layout.tsx:15-18` — an accessibility product shipping "Create Next App" as its document title is an a11y miss. **Fixed: real A11yFix Engine title + description.**
- [x] [Review][Patch] P-3 Report measure `max-w-[1040px]` is an arbitrary component literal — `apps/web/components/report-surface.tsx:100` — should be a token (e.g., `--container-report`) so Epic 4 / 3.2 / 3.3 surfaces inherit the reading measure instead of rediscovering it. **Fixed: `--container-report: 1040px` token declared in `@theme inline`; component now uses `max-w-report`.**
- [x] [Review][Patch] P-4 sessionStorage access is unguarded — `apps/web/components/audience-toggle.tsx:25-35` — `getItem`/`setItem` throw a SecurityError when storage is blocked/partitioned (private browsing, sandboxed iframe), which would crash the whole surface instead of degrading to the Client default. **Fixed: guarded `readStoredAudience`/`persistAudience` helpers swallow `SecurityError` → degrade to in-memory state.**
- [x] [Review][Patch] P-5 No automated test pins token values — `apps/web/app/globals.css` — the new suites only assert class-name strings (`bg-critical-container`, etc.), so a palette regression (e.g., `--critical` retargeted to green) passes all existing tests; the "measurable from globals.css" AC deserves at least one test reading the file. **Fixed: new `tests/design-tokens.test.ts` pins severity palette, severity theme mapping, font tokens, `--container-report`, dark overrides, and the shell token adoption.**
- [x] [Review][Defer] W-1 AudienceToggle restore re-runs when a caller passes an unstable `onChange` — `apps/web/components/audience-toggle.tsx:25-30` — latent today (ReportSurface passes the stable `setAudience`) — deferred, not actionable now.
- [x] [Review][Defer] W-2 The storage key `a11yfix:audience` is global across all future ReportSurfaces in a session — deferred, pre-existing at wiring time.

**Patch application (2026-08-16):** all 7 resolved items applied. Verification re-run: `pnpm test` → 127/127 across 11 files (9 new tests), `pnpm lint` clean, `pnpm build` OK.

### 2026-08-16 — dev-loop close-out (3-1 → done)

- **Count chips were unverifiable and read wrong (dev fixation):** the tabular count and its severity label render as adjacent-but-inline text (DESIGN.md "large tabular numbers with text labels"), so `getByText("2 Critical")` cannot match them (default matchers only see direct-text children). Worse, JSX strips newline/indent whitespace between children, so removing `{" "}` jammed the phrase into "1Critical" — a real screen-reader regression, not just a test artifact. Resolution: keep the explicit space separator, and assert the chip via its combined `textContent` through a scoped matcher + `within()`, pinning number+label+tinted-container in one assertion.
- **No `aria-label` on count chips:** the chips are role-less `<span>`s; `aria-label` there would trip axe `aria-prohibited-attr` and fail this product's self-audit invariant. The never-color-only constraint is met by the visible labels + health chip text, which expose the business register directly.
- **Verification (spec commands):** `pnpm --filter @a11yfix/web test` → 118/118 across 10 files; `pnpm --filter @a11yfix/web lint` → clean; `pnpm --filter @a11yfix/web build` → succeeds under Next 16 Turbopack (Inter/JetBrains Mono font swap + new client components compile).
- **Status:** story 3-1 marked done. No new deferrals; the wiring deferral already recorded in `deferred-work.md` stands.

## Design Notes

- **Severity fold** `critical+serious → Critical`: keeps axe's high band together so Moderate/Minor map 1:1 to axe — simple, monotone, testable. Flip to `serious → Moderate` only through the Ask First gate.
- Always-dark code/diff context stays raw-hex `bg-[#0f172a]` like `diff-viewer`; tokenizing it is out of scope.
- Toggle restores in `useEffect` (not a lazy initializer) to avoid a client/server hydration mismatch; default Client.
- Export is a present-and-accessible no-op until Epic 4; tests assert presence/a11y, not behavior.
- Reduce Motion is free here: introduce no transition/animation classes anywhere.

## Verification

**Commands:**
- `pnpm --filter @a11yfix/web test` -- expected: new suites green alongside existing ~100 tests.
- `pnpm --filter @a11yfix/web lint` -- expected: clean.
- `pnpm --filter @a11yfix/web build` -- expected: succeeds (font swap + new client components compile).

**Manual checks (if no CLI):**
- No report route in 3.1 — surface is verified by tests only (matches 2.3 `DiffViewer`). For visual/contrast sanity, temporarily mount the fixture surface on a scratch page and confirm the token palette + always-dark code surface in `pnpm dev`.