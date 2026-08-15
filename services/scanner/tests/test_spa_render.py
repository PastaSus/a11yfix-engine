"""Chromium-gated integration tests for SPA-render-aware harvesting.

Runs the real `run_scan` SPA-ready wait against locally served fixtures.
Skips when the Playwright Chromium binary is missing, matching the live-test
convention in test_main.py. Fully offline: fixtures come from the stdlib
`http.server` launched by the `spa_fixture_server` fixture.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any

import pytest

from services.scanner.app.errors import HarvestError
from services.scanner.app.harvest import run_scan

TEST_SCAN_ID = "01J00000000000000000000000"


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
async def test_deferred_spa_captures_late_violations(spa_fixture_server: str) -> None:
    """A node rendered after the shell contains a violation, and it is captured."""
    envelope: dict[str, Any] = await run_scan(
        f"{spa_fixture_server}/spa-deferred.html", TEST_SCAN_ID
    )
    violation_ids = {v["id"] for v in envelope["violations"]}
    assert "image-alt" in violation_ids
    image_alt = next(v for v in envelope["violations"] if v["id"] == "image-alt")
    assert image_alt["nodes"], "the deferred node's violation must carry a target node"


@pytest.mark.skipif(not _chromium_available(), reason="chromium binary not installed")
async def test_hold_spa_stability_fallback_captures_late_violations(
    spa_fixture_server: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The DOM-stability fallback alone must gate axe.run on a page that never idles."""
    monkeypatch.setattr("services.scanner.app.harvest.NETWORKIDLE_TIMEOUT_MS", 100)
    monkeypatch.setattr("services.scanner.app.harvest.DOM_STABILITY_BUDGET_MS", 3_000)
    monkeypatch.setattr("services.scanner.app.harvest.DOM_STABILITY_SAMPLE_MS", 100)

    envelope: dict[str, Any] = await run_scan(
        f"{spa_fixture_server}/spa-deferred-with-hold.html", TEST_SCAN_ID
    )
    violation_ids = {v["id"] for v in envelope["violations"]}
    assert "image-alt" in violation_ids, "stability fallback must capture the late-rendered node"
    image_alt = next(v for v in envelope["violations"] if v["id"] == "image-alt")
    assert image_alt["nodes"], "the deferred node's violation must carry a target node"


@pytest.mark.skipif(not _chromium_available(), reason="chromium binary not installed")
async def test_endless_spa_returns_typed_timeout(
    spa_fixture_server: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    """A page that never stabilizes returns a typed timeout — and never hangs."""
    monkeypatch.setattr("services.scanner.app.harvest.NETWORKIDLE_TIMEOUT_MS", 100)
    monkeypatch.setattr("services.scanner.app.harvest.DOM_STABILITY_BUDGET_MS", 1_500)
    monkeypatch.setattr("services.scanner.app.harvest.DOM_STABILITY_SAMPLE_MS", 100)

    started = time.monotonic()
    with pytest.raises(HarvestError) as exc:
        # 30s wall-clock guard: a scan that exceeds it fails loudly instead of hanging.
        await asyncio.wait_for(
            run_scan(f"{spa_fixture_server}/spa-endless.html", TEST_SCAN_ID),
            timeout=30,
        )
    assert time.monotonic() - started < 10, "scan took far longer than the shrunk stability budget"
    assert exc.value.code == "timeout"
    assert exc.value.stage == "harvest"
    assert set(exc.value.to_dict()) == {"code", "message", "stage"}