# A11yFix Engine

Automated accessibility and performance remediation platform: scan a public URL and get structured accessibility violations + Core Web Vitals, translated into business impact and reviewable React/Tailwind patches.

## Repository layout

- `apps/web/` — Next.js 16 (App Router) dashboard. The sole orchestrator: it calls the scanner, runs the AI personas, and serves the dual-audience dashboard.
- `services/scanner/` — stateless Python FastAPI harvest service (`POST /scan`): Playwright + axe-core, validates URLs, returns a schema-validated ScanResult envelope with typed `{ code, message, stage }` errors.
- `contracts/` — single source of truth for the interchange contract: `scan-result.schema.json` and `audit-report.schema.json` (both carry a mandatory `schemaVersion`).
- `_bmad-output/` — the spec-driven planning artifacts (product brief, PRD, UX spines, architecture spine, epic/story breakdown, sprint ledger). Read these to understand *why* the code is built the way it is.
- `_bmad/` — the [BMad Method](https://docs.bmad-method.org/) workflow framework used to produce those artifacts. Optional to use; the application builds and runs without it.

## Prerequisites

- [pnpm](https://pnpm.io/) 11.19+
- [uv](https://docs.astral.sh/uv/) (manages the Python 3.12+ environment)

## Getting Started

```bash
# Install JS workspace deps and the Python environment
pnpm install
uv sync

# Install the Chromium browser Playwright drives
uv run playwright install chromium

# Start the scanner on :8000
uv run uvicorn services.scanner.app.main:app --port 8000

# Start the dashboard on :3000 (in another terminal)
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

The dashboard's `/api/scan` route proxies `POST /scan` to the scanner. Set `SCANNER_URL` (default `http://127.0.0.1:8000`) to point elsewhere.

## Tests

```bash
# Scanner suite (validation, envelope schema conformance, live scan, error paths)
uv run python -m pytest services/scanner/tests/ -v
```

## Learn More

- [Next.js Documentation](https://nextjs.org/docs) — learn about Next.js features and API.
- [BMad Method](https://docs.bmad-method.org/) — the spec-driven workflow that produced this repository.
