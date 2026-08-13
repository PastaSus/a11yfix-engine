"""Endpoint tests for POST /scan. Browser-gated happy path plus pure error paths."""

from __future__ import annotations

from typing import Any

import pytest
from fastapi.testclient import TestClient

from services.scanner.app.main import app

client = TestClient(app)


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


def test_rejects_insecure_url_without_browser() -> None:
    res = client.post("/scan", json={"url": "http://example.com"})
    assert res.status_code == 400
    body = res.json()
    assert set(body) == {"code", "message", "stage"}
    assert body["code"] == "insecure_url"
    assert body["stage"] == "validate"


def test_rejects_malformed_url_without_browser() -> None:
    res = client.post("/scan", json={"url": "not-a-url"})
    assert res.status_code == 400
    body = res.json()
    assert body["code"] == "invalid_url"
    assert body["stage"] == "validate"


def test_rejects_empty_url() -> None:
    res = client.post("/scan", json={"url": ""})
    assert res.status_code == 400
    assert res.json()["stage"] == "validate"


def test_rejects_missing_body() -> None:
    res = client.post("/scan", json={})
    assert res.status_code == 422
    body = res.json()
    assert set(body) == {"code", "message", "stage"}
    assert body["code"] == "invalid_request"
    assert body["stage"] == "validate"


def test_rejects_extra_field() -> None:
    res = client.post("/scan", json={"url": "https://example.com", "surprise": 1})
    assert res.status_code == 422
    assert res.json()["code"] == "invalid_request"


@pytest.mark.skipif(not _chromium_available(), reason="chromium binary not installed")
def test_happy_path_live_scan() -> None:
    """End-to-end: scan a live public page and confirm a validated envelope."""
    res = client.post("/scan", json={"url": "https://example.com"})
    assert res.status_code == 200, res.text
    body: dict[str, Any] = res.json()
    assert body["schemaVersion"] == "1.0.0"
    assert isinstance(body["scanId"], str) and len(body["scanId"]) == 26
    assert body["url"] == "https://example.com"
    assert isinstance(body["violations"], list)
    assert isinstance(body["vitals"], dict)
    assert set(body["vitals"]) == {"lcp", "inp", "cls"}


@pytest.mark.skipif(not _chromium_available(), reason="chromium binary not installed")
def test_unreachable_host_returns_typed_failure() -> None:
    """A non-resolvable host must return a typed 502, never an unhandled exception."""
    res = client.post("/scan", json={"url": "https://nonexistent-domain-xyz123.com"})
    assert res.status_code == 502
    body = res.json()
    assert set(body) == {"code", "message", "stage"}
    assert body["code"] == "unreachable"
    assert body["stage"] == "harvest"
