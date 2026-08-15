"""URL scheme validation for the scanner.

Runs before any Playwright browser launch. Only `https://` URLs are accepted;
`http://`, `ftp:`, `javascript:` and unparseable strings raise a typed
ValidationError (`{ code, message, stage: "validate" }`, HTTP 400).
"""

from __future__ import annotations

import re
from urllib.parse import urlparse

from services.scanner.app.errors import ValidationError

ALLOWED_SCHEMES = ("https",)
HOSTNAME_PATTERN = re.compile(r"^[A-Za-z0-9.\-]+$")


def validate_url(url: str) -> str:
    """Validate a scan URL and return it trimmed.

    Raises ValidationError for malformed or insecure inputs. This is a pure
    function — it never launches a browser.
    """
    candidate = url.strip()
    if not candidate:
        raise ValidationError("A URL is required.", code="invalid_url")

    parsed = urlparse(candidate)

    if parsed.scheme not in ALLOWED_SCHEMES:
        if parsed.scheme:
            raise ValidationError(
                f"Only https:// URLs are accepted; got '{parsed.scheme}://'. "
                "http:// is insecure and other schemes are not scannable.",
                code="insecure_url",
            )
        raise ValidationError("A URL must include a scheme (https://).", code="invalid_url")

    if not parsed.netloc:
        raise ValidationError("The URL is missing a host (e.g. https://example.com).", code="invalid_url")

    try:
        port = parsed.port
    except ValueError:
        raise ValidationError("The URL contains an invalid port.", code="invalid_url")
    if port is not None and not (1 <= port <= 65535):
        raise ValidationError("The URL contains an out-of-range port.", code="invalid_url")

    hostname = parsed.hostname
    if not hostname:
        raise ValidationError("The URL is missing a hostname (e.g. https://example.com).", code="invalid_url")
    if not HOSTNAME_PATTERN.fullmatch(hostname):
        raise ValidationError("The URL contains an invalid hostname.", code="invalid_url")

    return candidate
