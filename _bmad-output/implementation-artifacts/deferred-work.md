# Deferred Work

Ledger of real findings surfaced in review that are not this story's problem. Reviewed during sprint sweep (`bmad-loop-sweep`) and before planning each following story.

- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: ScanResult and AuditReport schemas duplicate shared violations/vitals definitions and both pin schemaVersion "1.0.0" while being structurally incompatible envelopes.
  evidence: The web tier first consumes `audit-report.schema.json` in story 1.2; version/definition drift across the two files will bite there. Decide the versioning scheme (per-shape vs shared base `$ref`) when 1.2 lands.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: Severity vocabulary drifts — axe-core emits `critical/serious/moderate/minor` but the epic context fixes `critical/moderate/minor`.
  evidence: The schema enum already carries axe's native set; the render mapping to the UX-token vocabulary (critical/moderate/minor) belongs to Epic 3's report surface.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: "Public pages only" is not enforced at the network level — private/loopback/link-local hosts are scannable.
  evidence: Hunted in review. Dev-local scanning (e.g. `https://127.0.0.1`) may be desirable pre-hosted-tier; needs a product decision before SSRF-style guard or explicit dev-mode carve-out lands with story 1.4.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: No automated coverage for the web→scanner proxy seam (route.ts), and no CI workflow enforces lint/build/test.
  evidence: Route handler is verified only by manual `pnpm dev`; the seam gets real fixtures when story 1.4 builds the submission UI. A CI pipeline was deferred post-MVP by the architecture spine.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: `@a11yfix/contracts` is declared but unused by the web tier in 1.1, and no TS types are generated from the schemas.
  evidence: Web-side schema validation/types begin when the web tier owns an audit report (stories 1.2/1.3). The package skeleton is correct.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: Scanner has no `/health` endpoint and is runnable only from the repo root (package=false, cwd on sys.path).
  evidence: A liveness probe and launch recipe become necessary when the web tier orchestrates the pipeline (story 1.4); a console-script/uvicorn entrypoint can ride along.
- source_spec: `_bmad-output/implementation-artifacts/spec-1-1-capture-a-structured-scan-of-a-public-url.md`
  summary: Vendored `axe.min.js` (axe v4.11.4) ships with no provenance or re-vendor record, and `ruff` is configured in pyproject but not in the dev dependency group.
  evidence: Blind-hunter finding. Provenance belongs in a scanner README; pinning ruff (and adding CI) is covered by the deferred CI item above.

## Deferred from: code review of spec-1-1 (2026-08-15)

- No concurrency bound on headless instances — every `/scan` launches its own Chromium; bounded-instance budget belongs to story 1.3 (NFR-1).
- Cancellation via HTTP disconnect unimplemented; `asyncio.wait_for` cancels `run_scan` mid-`finally: await browser.close()` risking a leaked browser process.
- Zero observability — no scanId/duration/stage logging; pipeline stage timings (NFR-5, ADR-7) are epic-level.
- networkidle wait timeout swallowed with `pass` — SPA-render awareness ("axe runs only after render") is explicit story 1.2 scope.
- ScanResult/AuditReport duplicate shared definitions and AuditReport already drops `url`/`timestamp` from `required` — schema duplication tracked above.
- Chromium-gated live tests silently skip without the browser binary and depend on `https://example.com` (network flake) — CI enforcement is deferred post-MVP.
- No automated coverage for the web→scanner proxy seam (route.ts) — pinned when story 1.4 builds the submission UI.
- Private/loopback/link-local hosts scannable — needs a product decision before SSRF-style guard with story 1.4.
- Severity vocabulary drift — axe emits `critical/serious/moderate/minor`; the epic fixes `critical/moderate/minor`; render mapping belongs to Epic 3.
- Vendored `axe.min.js` ships with no provenance record; ruff configured but not in the dev dependency group.
- scanner→contracts coupling via hardcoded relative path, not a declared dependency.
- route.ts error codes are hardcoded strings not validated against the shared contract; `invalid_url/400` (route) vs `invalid_request/422` (scanner) inconsistent for the same failure class.
- `conversion_impact_estimate` typed as `string` can't be compared/summed — forces Epic 3 web tier to parse free text.