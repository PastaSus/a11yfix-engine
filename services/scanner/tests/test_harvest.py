"""Tests for the harvest stage: envelope building, violation extraction, and
schema conformance. The live Playwright scan is an integration test gated on
chromium being installed; pure logic runs without a browser."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
from jsonschema import Draft7Validator

from services.scanner.app.errors import HarvestError
from services.scanner.app.harvest import build_scan_result, extract_violations, load_axe_source, run_scan_with_timeout

CONTRACTS_DIR = Path(__file__).resolve().parents[3] / "contracts"
SCAN_RESULT_SCHEMA_PATH = CONTRACTS_DIR / "scan-result.schema.json"


def _load_schema() -> dict[str, Any]:
    return json.loads(SCAN_RESULT_SCHEMA_PATH.read_text(encoding="utf-8"))


SAMPLE_AXE_VIOLATION: dict[str, Any] = {
    "id": "image-alt",
    "impact": "critical",
    "tags": ["wcag2a", "wcag111", "cat.text-alternatives"],
    "description": "Ensures <img> elements have alternate text or a role of none or presentation",
    "help": "Images must have alternate text",
    "helpUrl": "https://dequeuniversity.com/rules/axe/4.11/image-alt?application=axeAPI",
    "nodes": [
        {
            "any": [{"id": "has-alt", "data": None}],
            "none": [],
            "all": [],
            "target": ["img[alt=\"\"]"],
            "html": '<img alt="">',
            "failureSummary": "Fix any of the following...",
        }
    ],
}


def test_extract_violations_maps_shape() -> None:
    result = extract_violations({"violations": [SAMPLE_AXE_VIOLATION]})
    assert len(result) == 1
    v = result[0]
    assert set(v) == {"id", "impact", "description", "helpUrl", "nodes"}
    assert v["id"] == "image-alt"
    assert v["impact"] == "critical"
    assert v["nodes"][0]["nodeId"] == 'img[alt=""]'
    assert v["nodes"][0]["coordinates"] is None


def test_extract_violations_empty() -> None:
    assert extract_violations({"violations": []}) == []


def test_build_scan_result_envelope() -> None:
    envelope = build_scan_result("https://example.com", "01J00000000000000000000000", [])
    assert envelope["schemaVersion"] == "1.0.0"
    assert envelope["url"] == "https://example.com"
    assert envelope["scanId"] == "01J00000000000000000000000"
    assert envelope["vitals"] == {"lcp": None, "inp": None, "cls": None}
    assert envelope["timestamp"]


def test_build_scan_result_validates_against_schema() -> None:
    validator = Draft7Validator(_load_schema())
    envelope = build_scan_result(
        "https://example.com",
        "01J00000000000000000000000",
        extract_violations({"violations": [SAMPLE_AXE_VIOLATION]}),
    )
    errors = sorted(validator.iter_errors(envelope), key=lambda e: list(e.path))
    assert not errors, [e.message for e in errors]


def test_envelope_rejects_unknown_fields() -> None:
    validator = Draft7Validator(_load_schema())
    envelope = build_scan_result("https://example.com", "01J00000000000000000000000", [])
    envelope["surprise"] = True
    assert any("Additional properties are not allowed" in e.message for e in validator.iter_errors(envelope))


def test_load_axe_source_present() -> None:
    src = load_axe_source()
    assert "axe" in src
    assert len(src) > 50_000


def test_scan_id_is_ulid_shaped() -> None:
    import ulid

    scan_id = str(ulid.new())
    assert len(scan_id) == 26
    assert scan_id.isalnum()


async def test_wall_clock_timeout_returns_typed_timeout(monkeypatch: pytest.MonkeyPatch) -> None:
    """A scan that exceeds the wall-clock bound must become a typed timeout, never hang."""
    async def never_returns(url: str, scan_id: str) -> dict[str, Any]:
        await asyncio.sleep(60)
        return {}

    import asyncio

    monkeypatch.setattr("services.scanner.app.harvest.run_scan", never_returns)
    with pytest.raises(HarvestError) as exc:
        await run_scan_with_timeout("https://example.com", "01J00000000000000000000000", timeout_seconds=0.05)
    assert exc.value.code == "timeout"
    assert exc.value.stage == "harvest"
    assert set(exc.value.to_dict()) == {"code", "message", "stage"}
