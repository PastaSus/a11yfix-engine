"""Chromium-gated integration test: `run_scan` captures a populated proof.

The fixture page (`proof.html`) deliberately carries a critical image-alt
violation (an <img> with no alt text), so the scanner's best-effort full-page
screenshot path is exercised from a real browser rather than a fake: the
envelope must carry a non-empty `{ mimeType, dataBase64 }` proof block that
decodes to real PNG bytes and still passes the canonical schema gate. Skips
when the Playwright Chromium binary is missing, matching the other live-scan
tests. Fully offline via the `spa_fixture_server` fixture.
"""

from __future__ import annotations

import base64
from typing import Any

import pytest

from services.scanner.app.harvest import run_scan
from services.scanner.app.main import validate_envelope

TEST_SCAN_ID = "01J00000000000000000000000"

PNG_SIGNATURE = b"\x89PNG\r\n\x1a\n"


def _chromium_available() -> bool:
    """True only when the Playwright Chromium binary is actually installed.

    The playwright *package* may be present while the browser executable is
    missing (a bare `pip install playwright`); the live integration tests must
    skip in that state rather than fail for environmental reasons.
    """
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return False
    try:
        with sync_playwright() as p:
            browser = p.chromium.launch()
            browser.close()
        return True
    except Exception:
        return False


@pytest.mark.skipif(not _chromium_available(), reason="chromium binary not installed")
async def test_proof_captured_from_real_browser_for_high_severity_page(
    spa_fixture_server: str,
) -> None:
    envelope: dict[str, Any] = await run_scan(f"{spa_fixture_server}/proof.html", TEST_SCAN_ID)

    violation_ids = {v["id"] for v in envelope["violations"]}
    assert "image-alt" in violation_ids, "the fixture must produce the high-severity violation"
    image_alt = next(v for v in envelope["violations"] if v["id"] == "image-alt")
    assert image_alt["impact"] in {"critical", "serious"}, image_alt

    proof = envelope["proof"]
    assert proof is not None, "a high-severity page must yield a proof, never null"
    assert set(proof) == {"mimeType", "dataBase64"}, proof.keys()
    assert proof["mimeType"] == "image/png"
    assert isinstance(proof["dataBase64"], str) and len(proof["dataBase64"]) >= 8
    decoded = base64.b64decode(proof["dataBase64"])
    assert decoded.startswith(PNG_SIGNATURE), "the proof must decode to real PNG bytes"

    validate_envelope(envelope)