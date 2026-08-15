"""Unit tests for URL validation (no browser required)."""

from __future__ import annotations

import pytest

from services.scanner.app.errors import ValidationError
from services.scanner.app.validation import validate_url


@pytest.mark.parametrize(
    "url",
    [
        "https://example.com",
        "https://www.udemy.com",
        "https://example.com/path?q=1",
        "https://example.com:8443/a/b",
        "https://sub.example.co.uk",
    ],
)
def test_accepts_valid_https(url: str) -> None:
    assert validate_url(url) == url


@pytest.mark.parametrize(
    ("url", "code"),
    [
        ("http://example.com", "insecure_url"),
        ("http://insecure.example.com", "insecure_url"),
        ("ftp://example.com", "insecure_url"),
        ("javascript:alert(1)", "insecure_url"),
        ("data:text/html,hi", "insecure_url"),
        ("file:///etc/passwd", "insecure_url"),
    ],
)
def test_rejects_insecure_schemes(url: str, code: str) -> None:
    with pytest.raises(ValidationError) as exc:
        validate_url(url)
    assert exc.value.code == code
    assert exc.value.stage == "validate"


@pytest.mark.parametrize(
    "url",
    [
        "",
        "   ",
        "not-a-url",
        "example.com",
        "https://",
        "https:/missing-slash.com",
        "////",
        "https://example.com:99999",
        "https://example.com:abc",
    ],
)
def test_rejects_malformed(url: str) -> None:
    with pytest.raises(ValidationError) as exc:
        validate_url(url)
    assert exc.value.code == "invalid_url"
    assert exc.value.stage == "validate"


def test_error_shape() -> None:
    with pytest.raises(ValidationError) as exc:
        validate_url("http://example.com")
    body = exc.value.to_dict()
    assert set(body) == {"code", "message", "stage"}
    assert body["stage"] == "validate"
    assert body["code"] == "insecure_url"
    assert body["message"]
