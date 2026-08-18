---
title: '2-3: Render patches as reviewable diffs'
type: 'feature'
created: '2026-08-16'
status: 'done'
baseline_commit: 'a1bb6235c7c0837958d41a96050ebfdfa9494265'
review_loop_iteration: 1
context:
  - '{project-root}/_bmad-output/implementation-artifacts/epic-2-context.md'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** A developer cannot yet review what the Architect proposed — the patches exist only as strings in the AuditReport, so nothing tells them which lines change before they decide to merge.

**Approach:** Build a self-contained web-tier `DiffViewer` component (`apps/web/components/diff-viewer.tsx`) that renders one `ArchitectPatch` as a line-by-line unified diff on an always-dark, monospace surface with a `+/-/ ` gutter, red/green/gray per changed line, muted line numbers, a visible "Proposed — not applied" badge, and a copy action. It is presentational and owns no apply-to-code control (the product invariant). Nothing is wired into a page this story — Epic 3's Developer View consumes it.

## Boundaries & Constraints

**Always:**
- Single standalone component + its test suite, mirroring story 2.1/2.2's pattern of dead-code-until-wired modules. No route wiring, no `/api/scan` changes, no persistence.
- Diff surface is always dark regardless of theme, in monospace (`font-mono` token). Rows are classified: added (`+`, green), removed (`-`, red), context/header (` `, `@@`, `---`, `+++`, gray). Gutter chars are real visible text — change type is never conveyed by color alone. Line numbers muted and `aria-hidden`.
- A visible "Proposed — not applied." badge accompanies every patch; microcopy stays neutral. There is no apply-to-code, accept, or merge control anywhere in the component.
- Copy action writes the raw `patch.diff` string via `navigator.clipboard` with a quiet inline confirmation; target ≥ 44px (button `h-11`), keyboard-operable (native `<button>`), no animation (instant under Reduce Motion).
- The component accepts an `ArchitectPatch` (typed from `@/lib/translate/client`, re-exported via `@/lib/translate/architect`). Long lines wrap without horizontal clipping (`whitespace-pre-wrap`).

**Ask First:**
- None new. Epic 3 owns the wrapper/panel wiring, the audience toggle, and the always-dark token foundation (3.1); 2.3 uses Tailwind arbitrary values rather than adding tokens to `globals.css` so the 3.1 design foundation stays clean.

**Never:**
- No apply-to-code control, no write to any repository, no auto-apply path.
- Do not modify `contracts/*`, scanner code, `globals.css`, or `lib/translate/client.ts`. No page or route changes.
- No new dependencies (use existing tailwind/prettier/Tailwind classes and `@testing-library/react`).
- Do not build layout wrappers, lists across multiple patches, or the Developer View — Epic 3's job.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| HAPPY_PATH | Valid unified diff (headers, `+`/`-`/context lines) | Panel renders on dark monospace surface: each line classified with `+/-/ ` gutter + color, muted line numbers, "Proposed — not applied." badge, copy button | N/A |
| HAPPY_PATH | Copy button activated (keyboard or click) with clipboard available | Raw `patch.diff` written to clipboard; quiet inline "Copied" confirmation | Clipboard rejection → no crash, button stays usable, no false success |
| EDGE_CASE | Empty `diff` string | Empty-state note "No diff to render." — still shows badge and title; no rows | N/A |
| EDGE_CASE | Line longer than 100 chars | Wraps within the panel; no horizontal clipping at 150% zoom | N/A |
| EDGE_CASE | Diff contains `\ No newline at end of file` note and `@@`/`---`/`+++` headers | Note + headers render as gray context, not red/green add/remove | N/A |
| EDGE_CASE | `navigator.clipboard` undefined (older runtime) | Copy button present but degrades gracefully: no thrown error on activation | Nil — the action is a no-op, not a failure |

</frozen-after-approval>

## Code Map

- `apps/web/components/diff-viewer.tsx` -- NEW. `"use client"` component `DiffViewer({ patch }: { patch: ArchitectPatch })`. Internal pure helpers: `classifyLines(diff)` splitting on `\r?\n` and tagging each line `add` | `del` | `context` (headers `@@`, `--- `, `+++ ` and empty lines → context); copy handler using `navigator.clipboard.writeText`, catches rejections, `useState` for `copied` confirmation. Dark surface via arbitrary values (e.g. `bg-[#0f172a]`, `font-mono`) + red/green/gray per line type; per-line rows keyed by index.
- `apps/web/lib/translate/architect.ts` -- READ-ONLY reuse point. Re-exports `ArchitectPatch` (import `type` only) — the component consumes the same type the persona emits, so type↔schema no drift here.
- `apps/web/tests/diff-viewer.test.tsx` -- NEW vitest suite following `tests/progress-stepper.test.tsx` conventions (`@testing-library/react`, `cleanup` in `afterEach`). No `@vitest-environment node` — jsdom is the default (needed for `navigator.clipboard`).
- `apps/web/vitest.config.mts` -- READ-ONLY: jsdom default + `@` tsconfig alias already configured.

## Tasks & Acceptance

**Execution:**
- [x] `apps/web/components/diff-viewer.tsx` -- create `DiffViewer` client component: classify diff lines, render always-dark monospace rows with `+/-/ ` gutter + color + muted line numbers, "Proposed — not applied." badge, copy button with quiet confirmation, empty-diff state, wrap-without-clip styling -- FR-7, UXD-9, NFR-6, NFR-8
- [x] `apps/web/tests/diff-viewer.test.tsx` -- unit tests pinning the I/O matrix rows: add/del/context/header classification via `data-line-type`, badge copy, copy writes raw diff via mocked `navigator.clipboard`, copy-failure no-crash, empty-diff state, long-line wrap class, keyboard-activatable copy -- AC 1-4

**Acceptance Criteria:**
- Given an `ArchitectPatch` with a valid unified diff, when `DiffViewer` renders, then the diff appears on an always-dark monospace surface with a `+/-/ ` gutter, muted line numbers, red/green/gray per line type, a visible "Proposed — not applied." badge, and a copy action.
- Given the rendered diff, when I scan the panel for an apply-to-code control, then none exists — the panel is review-only.
- Given a copy activation with the clipboard available, when the button is triggered by keyboard, then the raw diff text is written to the clipboard and a quiet confirmation appears.
- Given any diff content, when the panel is zoomed to 150%, then lines wrap without horizontal clipping.

## Spec Change Log

- 2026-08-16: Implemented story 2.3. Added `apps/web/components/diff-viewer.tsx` (standalone `"use client"` `DiffViewer` component: pure `classifyLines` splitting on `\r?\n` and tagging add/del/context with `@@`/`--- ` /`+++ `/blank lines as context, always-dark `bg-[#0f172a]` monospace surface, real `+`/`-`/`·` gutter chars with green/red/gray per line type, muted `aria-hidden` line numbers, `whitespace-pre-wrap` + `min-w-0` wrap-without-clip, "Proposed — not applied." badge, `h-11` native copy button with feature-detected `navigator.clipboard` + `aria-live="polite"` "Copied" confirmation reset after 1.5 s with unmount cleanup, empty-diff "No diff to render." state, and no apply-to-code control) and `apps/web/tests/diff-viewer.test.tsx` (13 jsdom tests pinning the full I/O matrix: classification, header/`\ No newline` context, raw-diff clipboard write, rejection no-crash/no-false-success, clipboard-unavailable no-throw, empty state, long-line wrap, keyboard activation, `aria-hidden` line numbers). Verified: `pnpm --filter @darkhouse/web test` (95 pass, 82 regression + 13 new), lint clean, build succeeds. Step-03 verification: all Tasks & AC met; Matrix Test Audit passed (every I/O matrix row covered by a passing test). Next: step-04 review.
- 2026-08-16 (review loop 1): Three-layer review (blind-hunter, edge-case-hunter — returned `[]` twice, no findings —, verification-gap) merged. 13 unique findings: 10 patches + 3 rejected (no intent_gap/bad_spec, no loopback). Applied via the step-03 subagent: `useId()` for the diff-viewer heading (duplicate-id prevention for Epic 3's per-patch lists), `classifyLines` empty-state now `diff.trim() === ""` (whitespace/newline-only diffs hit "No diff to render."), `handleCopy` wrapped in try/catch (sync clipboard accessor/`writeText` throws stay quiet), wrap test asserts `min-w-0` too, new review-only-invariant test (exactly one button, no apply/accept/merge/confirm/save control), new space-prefixed context-content-line coverage (branch + `·` gutter), keyboard test now asserts native `BUTTON` element (the browser keyboard contract) instead of inert key simulation, `aria-hidden` test scoped to line-number spans per row, truly-absent-clipboard branch exercised by real click, fake-timer test pinning the 1500 ms "Copied" reset + unmount timer cleanup. Verified: 100 tests pass (95 → 100), lint clean, build succeeds. Rejected with evidence: `·` context gutter vs literal space (Design Notes explicitly chose `·`, approved at checkpoint; satisfies the frozen "visible text, never color-only" requirement), row-index line numbers (diffs are AI-proposed/ungrounded per 2.2 deferral so source-accurate numbers would be fabricated; rendered `@@` headers carry true positions; spec required only muted numbers), `rationale`/`wcag_rule` not surfaced (epic cross-story deps put rationale in Epic 3's Developer View rows — out of frozen scope). KEEP: `useId`-driven heading, native `<button>` copy with quiet sync+async-failure handling, `data-line-type`/`data-surface="dark"` style hooks, `classifyLines` pure-function classification, and the review-only invariant test pattern.

## Design Notes

- **Classification, not styling-first:** classify each raw line `add`/`del`/`context` in a pure function (testable without DOM), then map type → color + `data-line-type` attribute. Gutter characters remain real text (`+`, `-`, `·`) so a color-blind or SR user still knows the change type (never color-only). `@@`, `--- `, `+++ ` headers and blank lines are context (gray).
- **Style hook:** each row carries `data-line-type`; the panel root carries `data-surface="dark"` so tests and future CSS both have a stable hook without depending on arbitrary class strings in assertions.
- **Copy:** `copied` boolean state toggles an `aria-live="polite"` "Copied" note; revert after ~1.5s via `setTimeout` guarded by a ref so unmount doesn't warn. `navigator.clipboard` guarded — feature-detect and no-op on rejection.
- **Zero deps:** pure Tailwind + `@testing-library/react`. No new packages, no `globals.css` edits (3.1 owns the token foundation).

## Verification

**Commands:**
- `pnpm --filter @darkhouse/web test` -- expected: all suites pass, including the new `diff-viewer.test.tsx` and the unchanged translate regression suites.
- `pnpm --filter @darkhouse/web lint` -- expected: clean ESLint.
- `pnpm --filter @darkhouse/web build` -- expected: typecheck + build succeed.

## Suggested Review Order

**Line classification engine**

- Pure classifier decides add/remove/context and folds whitespace-only diffs into the empty state (entry point to the whole change)
  [`diff-viewer.tsx:12`](../../apps/web/components/diff-viewer.tsx#L12)

- Gutter glyphs are real text and per-kind colors are never the only signal
  [`diff-viewer.tsx:37`](../../apps/web/components/diff-viewer.tsx#L37)

**Review-only surface & copy action**

- Always-dark monospace surface with `useId`-driven heading so Epic 3's per-patch instances never collide
  [`diff-viewer.tsx:86`](../../apps/web/components/diff-viewer.tsx#L86)

- Copy is a native button whose sync and async failures both stay quiet; confirm resets after 1.5 s
  [`diff-viewer.tsx:63`](../../apps/web/components/diff-viewer.tsx#L63)

**Invariant & accessibility**

- No apply/accept/merge control anywhere; only the copy button may exist
  [`diff-viewer.test.tsx:44`](../../apps/web/tests/diff-viewer.test.tsx#L44)

- Line numbers are `aria-hidden`; keyboard guarantee pinned via native `BUTTON` element
  [`diff-viewer.test.tsx:103`](../../apps/web/tests/diff-viewer.test.tsx#L103)

- Clipboard-unavailable branch, long-line wrap (`min-w-0`), and the 1500 ms reset + unmount cleanup are each pinned
  [`diff-viewer.test.tsx:151`](../../apps/web/tests/diff-viewer.test.tsx#L151)