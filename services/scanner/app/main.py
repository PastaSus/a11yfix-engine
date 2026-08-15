"""FastAPI harness for the A11yFix scanner.

Stateless HTTP filter: `POST /scan` -> ScanResult envelope. Validates the URL
(scheme, parseability) before any browser launch, harvests with Playwright +
axe-core, validates the output against the canonical contract schema, and
returns either a ScanResult envelope (HTTP 200) or a typed
`{ code, message, stage }` error (HTTP 400/502).
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Any

import ulid
from fastapi import FastAPI
from jsonschema import Draft7Validator, FormatChecker
from pydantic import BaseModel, ConfigDict

from services.scanner.app.errors import HarvestError, ScanError, register_exception_handlers
from services.scanner.app.harvest import run_scan_with_timeout
from services.scanner.app.validation import validate_url

CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"
SCAN_RESULT_SCHEMA_PATH = CONTRACTS_DIR / "scan-result.schema.json"

app = FastAPI(
    title="A11yFix Scanner",
    description="Stateless harvest service: POST /scan runs axe-core via Playwright and returns a ScanResult envelope.",
    version="0.1.0",
)
register_exception_handlers(app)

_scan_result_validator: Draft7Validator | None = None
_format_checker = FormatChecker()


@_format_checker.checks("date-time")
def _check_date_time(value: object) -> bool:
    """Validate ISO-8601 date-time without depending on python-dateutil."""
    if not isinstance(value, str):
        return True
    try:
        datetime.fromisoformat(value.replace("Z", "+00:00"))
        return True
    except ValueError:
        return False


def _get_schema_validator() -> Draft7Validator:
    """Load the canonical ScanResult schema once and cache the validator."""
    global _scan_result_validator
    if _scan_result_validator is None:
        schema = json.loads(SCAN_RESULT_SCHEMA_PATH.read_text(encoding="utf-8"))
        _scan_result_validator = Draft7Validator(schema, format_checker=_format_checker)
    return _scan_result_validator


def validate_envelope(envelope: dict[str, Any]) -> None:
    """Validate the built envelope against the shared contracts schema.

    A failure here means the scanner produced output that violates the single
    interchange contract — treat it as a harvest-stage failure.
    """
    errors = sorted(_get_schema_validator().iter_errors(envelope), key=lambda e: list(e.path))
    if errors:
        detail = "; ".join(f"{'/'.join(str(p) for p in e.path)}: {e.message}" for e in errors[:3])
        raise HarvestError(f"Scan output failed contract validation: {detail}", code="schema_error")


class ScanRequest(BaseModel):
    """Accepted request body. Only `{ url: str }` crosses the HTTP seam."""

    model_config = ConfigDict(extra="forbid")

    url: str


@app.post("/scan", response_model=None)
async def scan(payload: ScanRequest) -> dict[str, Any]:
    """Validate the URL, harvest the page, and return a validated ScanResult."""
    url = validate_url(payload.url)
    scan_id = str(ulid.new())
    envelope = await run_scan_with_timeout(url, scan_id)
    validate_envelope(envelope)
    return envelope
