"""Vitals capture tests: chromium-gated integration against a local fixture plus
pure `collect_vitals` normalization that never launches a browser.

The fixture page (`vitals.html`) is designed so the largest contentful element
renders at load (so LCP is measurable) and a deferred banner pushes it down with
no user input (so CLS is nonzero). Both are read back from the same page load that
axe-core analyzed.
"""

from __future__ import annotations

from typing import Any

import pytest

from services.scanner.app.harvest import collect_vitals, run_scan
from services.scanner.app.main import validate_envelope

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


def test_collect_vitals_golden_example() -> None:
    raw = {"lcp": 812.5, "cls": 0.034}
    assert collect_vitals(raw) == {"lcp": 812.5, "inp": None, "cls": 0.034}


def test_collect_vitals_all_nulls_when_probe_missing() -> None:
    assert collect_vitals(None) == {"lcp": None, "inp": None, "cls": None}
    assert collect_vitals({}) == {"lcp": None, "inp": None, "cls": None}
    assert collect_vitals({"lcp": None, "cls": None}) == {
        "lcp": None,
        "inp": None,
        "cls": None,
    }


def test_collect_vitals_keeps_zero_cls_not_null() -> None:
    """A measured clean page (observers fired, zero shifts) reports 0.0, not null."""
    assert collect_vitals({"lcp": None, "cls": 0}) == {
        "lcp": None,
        "inp": None,
        "cls": 0.0,
    }


def test_collect_vitals_null_cls_stays_null() -> None:
    """A page whose probe never ran reports cls null — the unmeasured sentinel."""
    assert collect_vitals({"lcp": 100.0, "cls": None}) == {
        "lcp": 100.0,
        "inp": None,
        "cls": None,
    }


def test_collect_vitals_rejects_non_finite_numbers() -> None:
    """NaN/Infinity must collapse to null so JSONResponse serialization can't fail."""
    assert collect_vitals({"lcp": float("nan"), "cls": float("inf")}) == {
        "lcp": None,
        "inp": None,
        "cls": None,
    }
    assert collect_vitals({"lcp": float("-inf"), "cls": 1}) == {
        "lcp": None,
        "inp": None,
        "cls": 1.0,
    }


def test_collect_vitals_rejects_non_number_values() -> None:
    assert collect_vitals({"lcp": "120ms", "cls": None}) == {
        "lcp": None,
        "inp": None,
        "cls": None,
    }


@pytest.mark.skipif(not _chromium_available(), reason="chromium binary not installed")
async def test_vitals_captured_from_same_page_load(spa_fixture_server: str) -> None:
    envelope: dict[str, Any] = await run_scan(f"{spa_fixture_server}/vitals.html", TEST_SCAN_ID)
    vitals = envelope["vitals"]
    assert vitals["inp"] is None
    assert isinstance(vitals["lcp"], (int, float)) and vitals["lcp"] > 0, vitals
    assert isinstance(vitals["cls"], (int, float)) and vitals["cls"] > 0, vitals
    validate_envelope(envelope)