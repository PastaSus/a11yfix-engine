<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

<!-- bmad:context -->
<!-- Verified 2026-08-15 against 48d5dc5. Managed by bmad-project-context; edits inside this block are replaced on refresh. Keep anything you want preserved outside the markers. -->

## darkhouse

Automated web accessibility and performance remediation platform. Scans a public URL, produces structured accessibility violations + Core Web Vitals via Python harvest service, translates via AI personas (Epic 2, planned), and renders in a dual-audience Next.js dashboard. Monorepo: `apps/web` (Next.js 16 App Router), `services/scanner` (Python FastAPI + Playwright + axe-core), `contracts/` (shared JSON Schema). Planning artifacts live in `_bmad-output/`.

## Policy

- Patches are proposed, never auto-applied — no code path in either tier applies a patch to any repository. This is a product invariant.
- Public pages only; no user credentials or session data stored or logged.
- AI personas use free-tier providers only; bounded concurrency keeps full runs at zero recurring cost.
- `contracts/` contains the canonical JSON Schema — both Python and TS validate from it. Never hand-edit; regenerate from the schema.

## Where things are

- Scanner service entry: `services/scanner/app/main.py` — `POST /scan`
- Web dashboard entry: `apps/web/app/page.tsx` — `ScanForm` component
- API proxy route: `apps/web/app/api/scan/route.ts` — proxies to scanner (`SCANNER_URL` env)
- Shared schemas: `contracts/scan-result.schema.json`, `contracts/audit-report.schema.json`
- Planning docs: `_bmad-output/planning-artifacts/` (brief, PRD, architecture, UX, epics)
- Sprint tracker: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Epic 1 is done (all 4 stories complete, merged via PR #1). Epic 2 is in-progress (`feat/epic-2-ai-translation` branch); Epics 3-4 are backlog.

## Running and verifying

- Scanner tests require Chromium installed: `uv run playwright install chromium` (once per machine).
- Run scanner tests from repo root: `uv run python -m pytest services/scanner/tests/ -v` — running from `services/scanner/` breaks module resolution.
- Run web tests: `pnpm --filter @darkhouse/web test` (vitest, jsdom environment).
- Lint: `pnpm lint` runs ESLint with `eslint-config-next/core-web-vitals` + `eslint-config-next/typescript` in `apps/web`.
- Both services must run separately: scanner on `:8000` (`uv run uvicorn services.scanner.app.main:app --port 8000`), dashboard on `:3000` (`pnpm dev`).
- `pnpm install` installs JS workspace deps; `uv sync` installs the Python environment — both are required after clone.

## Conventions that differ from defaults

- Scanner is a stateless HTTP filter — holds no business state, returns one typed envelope per request. Never add storage or session state to the scanner.
- Error envelope is always `{ code, message, stage }` with HTTP status mapping (400/422/500/502/503). Follow this shape, not generic error objects.
- URL validation is https-only in both tiers: `services/scanner/app/validation.py` and `apps/web/lib/validate-scan-url.ts` mirror each other — keep them in sync.
- Tailwind v4 uses `@theme inline` in `globals.css` for design tokens — not `tailwind.config.js`.

## Known pitfalls

- Next.js 16 has breaking API changes from prior versions — read `node_modules/next/dist/docs/` before writing Next.js code. The auto-generated block at the top of this file is re-created by `next dev`.
- `vitest.config.mjs` uses `vite-tsconfig-paths` plugin — paths must resolve via tsconfig `@/*` alias, not relative paths.
- `pyproject.toml` sets `package = false` — the root is a virtual project, not an installable wheel. Never add `[build-system]` entries.
- pytest `asyncio_mode = "auto"` — async tests run without explicit decorators; do not add `@pytest.mark.asyncio` unless overriding.

<!-- /bmad:context -->
