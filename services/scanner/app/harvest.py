"""Playwright + axe-core harvest stage.

Navigates to a URL with a headless browser, waits for the page to be SPA-ready
(network idle, else DOM-stable), injects axe-core, runs the analysis, and
returns a schema-validated ScanResult envelope (violations + vitals). Never
blocks indefinitely: navigation, network-idle and DOM-stability waits are all
timeout-bound, and a concurrent-scan slot (module-level asyncio.Semaphore) caps
how many Chromium instances may run at once — saturation past the slot wait
becomes a typed HTTP 503 `busy` error. Vitals (LCP/CLS) are captured from the
same page load as the violations via an init script registered before
navigation. Any navigation failure becomes a typed HarvestError.
"""

from __future__ import annotations

import asyncio
import math
import time
from datetime import datetime, timezone
from importlib import resources
from typing import Any

from playwright.async_api import Error as PlaywrightError
from playwright.async_api import TimeoutError as PlaywrightTimeoutError
from playwright.async_api import async_playwright

from services.scanner.app.errors import HarvestError

SCHEMA_VERSION = "1.0.0"
NAVIGATION_TIMEOUT_MS = 30_000
NETWORKIDLE_TIMEOUT_MS = 30_000
DOM_STABILITY_BUDGET_MS = 15_000
DOM_STABILITY_SAMPLE_MS = 500
DOM_STABILITY_SAMPLES_REQUIRED = 3
MAX_CONCURRENT_SCANS = 3
SCAN_SLOT_TIMEOUT_MS = 30_000

VITALS_INIT_SCRIPT = r"""
(() => {
  const vitals = window.__darkhouseVitals = { lcp: null, cls: null };
  try {
    new PerformanceObserver((list) => {
      const entries = list.getEntries();
      if (entries.length) {
        vitals.lcp = entries[entries.length - 1].startTime;
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
  } catch (error) {}
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) {
          vitals.cls = (vitals.cls ?? 0) + entry.value;
        }
      }
    }).observe({ type: "layout-shift", buffered: true });
  } catch (error) {}
})();
"""

_SCAN_SLOT = asyncio.Semaphore(MAX_CONCURRENT_SCANS)


def load_axe_source() -> str:
    """Read the vendored axe-core minified bundle for page injection."""
    try:
        return resources.files("services.scanner.app").joinpath("axe.min.js").read_text(encoding="utf-8")
    except (FileNotFoundError, OSError) as exc:
        raise HarvestError(
            "The axe-core bundle is missing from the scanner install.",
            code="harvest_script_error",
        ) from exc


def extract_violations(axe_results: dict[str, Any]) -> list[dict[str, Any]]:
    """Normalize axe-core violations into the ScanResult `violations` shape.

    Each violation keeps `id`, `impact`, `description`, `helpUrl` and a `nodes`
    array of `{ nodeId, coordinates }`. nodeId is the axe target selector;
    coordinates are null; real geometry lands in a later story.
    """
    violations: list[dict[str, Any]] = []
    for raw in axe_results.get("violations", []):
        nodes = []
        for node in raw.get("nodes", []):
            target = node.get("target", [])
            node_id = (
                " > ".join(target[0]) if target and isinstance(target[0], list) else " > ".join(target)
            )
            if not node_id:
                node_id = node.get("html", "") or f"node-{len(nodes)}"
            nodes.append({"nodeId": node_id, "coordinates": None})
        violations.append(
            {
                "id": raw.get("id", ""),
                "impact": raw.get("impact", "minor"),
                "description": raw.get("description", ""),
                "helpUrl": raw.get("helpUrl"),
                "nodes": nodes,
            }
        )
    return violations


def _vital_number(value: object) -> float | None:
    """Coerce a probe value to a float, or None when it isn't a real number.

    `bool` is excluded (it is an `int` subclass) so a true/false flag can never
    masquerade as a vital reading. NaN and Infinity are also rejected: a
    non-finite reading would otherwise slip into the envelope and break the
    JSON serialization (FastAPI writes with `allow_nan=False`).
    """
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    number = float(value)
    if math.isnan(number) or math.isinf(number):
        return None
    return number


def collect_vitals(raw: dict[str, Any] | None) -> dict[str, Any]:
    """Normalize the probe's `window.__darkhouseVitals` into the ScanResult shape.

    Pure function (no browser I/O): takes the object already read from the page
    and returns `{ lcp, inp, cls }`. `lcp`/`cls` are numbers when measurable and
    None otherwise; `inp` is always None because an automated scan never
    synthesizes interaction. `cls` uses the null sentinel the probe seeds: a
    measured clean page (observers fired, zero shifts) survives as 0.0, while an
    unmeasured page (probe never ran) reads None.
    """
    if not isinstance(raw, dict):
        return {"lcp": None, "inp": None, "cls": None}
    return {
        "lcp": _vital_number(raw.get("lcp")),
        "inp": None,
        "cls": _vital_number(raw.get("cls")),
    }


def build_scan_result(
    url: str,
    scan_id: str,
    violations: list[dict[str, Any]],
    vitals: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build the ScanResult envelope. `vitals` defaults to all-null so callers
    that don't capture vitals (pre-1.3 paths and tests) stay schema-conformant."""
    if vitals is None:
        vitals = {"lcp": None, "inp": None, "cls": None}
    return {
        "schemaVersion": SCHEMA_VERSION,
        "scanId": scan_id,
        "url": url,
        "violations": violations,
        "vitals": {"lcp": vitals.get("lcp"), "inp": vitals.get("inp"), "cls": vitals.get("cls")},
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def dom_has_stabilized(
    samples: list[int], required_equal: int = DOM_STABILITY_SAMPLES_REQUIRED
) -> bool:
    """True when the trailing DOM fingerprint samples are identical.

    Pure decision helper for the SPA-ready wait: `samples` is the history of
    fingerprint readings and the decision is made on the last `required_equal`
    entries, so it can be unit-tested without launching a browser. Returns False
    until enough samples exist.
    """
    if len(samples) < required_equal:
        return False
    return len(set(samples[-required_equal:])) == 1


async def wait_spa_ready(page: Any, url: str) -> None:
    """Wait until the page is SPA-ready: network idle, else DOM-stable.

    Tries `networkidle` first. Pages that never go idle (long-polling /
    websockets) fall back to polling a cheap DOM fingerprint (body's innerHTML
    length) until the content stops churning. Both phases are bounded: the
    network-idle wait by NETWORKIDLE_TIMEOUT_MS, the stability budget by
    DOM_STABILITY_BUDGET_MS. Exhausting the budget raises a typed
    HarvestError(`{ code: "timeout", stage: "harvest" }`) so axe-core never
    runs against an unrendered shell and the scan never hangs.
    """
    try:
        await page.wait_for_load_state("networkidle", timeout=NETWORKIDLE_TIMEOUT_MS)
        return
    except PlaywrightTimeoutError:
        pass

    sample_seconds = DOM_STABILITY_SAMPLE_MS / 1000
    start = time.monotonic()
    samples: list[int] = []
    while time.monotonic() - start < DOM_STABILITY_BUDGET_MS / 1000:
        sample: int = await page.evaluate(
            "() => document.body ? document.body.innerHTML.length : 0"
        )
        samples.append(sample)
        if dom_has_stabilized(samples):
            return
        await asyncio.sleep(sample_seconds)
    raise HarvestError(
        f"The page at {url} kept changing its DOM and never stabilized within "
        f"{DOM_STABILITY_BUDGET_MS // 1000}s.",
        code="timeout",
    )


async def acquire_scan_slot() -> None:
    """Wait up to SCAN_SLOT_TIMEOUT_MS for a concurrent-scan slot.

    Returns without a value once a slot is free. When every slot stays occupied
    past the bound it raises HarvestError(`{ code: "busy", stage: "harvest" }`,
    HTTP 503 via the registered handler), so saturation becomes a cheap typed
    error instead of an unbounded queue or a hang. The timeout is that wait's
    own bound; the caller must release the slot in a `finally`.
    """
    try:
        await asyncio.wait_for(_SCAN_SLOT.acquire(), timeout=SCAN_SLOT_TIMEOUT_MS / 1000)
    except asyncio.TimeoutError as exc:
        raise HarvestError(
            f"The scanner is at capacity ({MAX_CONCURRENT_SCANS} concurrent scans). "
            f"Please retry shortly.",
            code="busy",
            status_code=503,
        ) from exc


async def run_scan(url: str, scan_id: str) -> dict[str, Any]:
    """Harvest a public URL: navigate, wait, inject axe-core, run analysis.

    The scan holds a concurrent-scan slot for its entire lifetime (acquired
    before any browser launch, guarded so only a successful acquisition is ever
    released, always in the outermost `finally`). Vitals (LCP/CLS) are measured
    from the same page load as the axe violations via an init script registered
    before navigation; the vitals read itself is best-effort — a probe-read
    failure falls back to all-null vitals rather than failing the scan. Raises
    HarvestError (`{ code, stage }` with code "unreachable" | "timeout" | "busy"
    | ..., HTTP by code: 502 for harvest failures, 503 for `busy`) on every
    failure path — never an unhandled exception or a hang.
    """
    slot_acquired = False
    await acquire_scan_slot()
    slot_acquired = True
    try:
        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch()
                try:
                    page = await browser.new_page()
                    await page.add_init_script(VITALS_INIT_SCRIPT)
                    try:
                        await page.goto(url, timeout=NAVIGATION_TIMEOUT_MS, wait_until="domcontentloaded")
                    except PlaywrightTimeoutError as exc:
                        raise HarvestError(
                            f"The page at {url} took too long to load (>{NAVIGATION_TIMEOUT_MS // 1000}s).",
                            code="timeout",
                        ) from exc
                    except PlaywrightError as exc:
                        raise HarvestError(
                            f"We couldn't reach {url}. It may be down, or the network is slow. ({exc.__class__.__name__})"
                        ) from exc

                    await wait_spa_ready(page, url)

                    try:
                        await page.add_script_tag(content=load_axe_source())
                        axe_results: dict[str, Any] = await page.evaluate("() => window.axe.run()")
                        if not isinstance(axe_results, dict):
                            raise HarvestError(
                                f"Axe-core returned an unexpected result on {url}; it may be blocked by a Content-Security-Policy. "
                                f"(result type: {type(axe_results).__name__})",
                                code="harvest_script_error",
                            )
                    except (PlaywrightError, PlaywrightTimeoutError) as exc:
                        raise HarvestError(
                            f"Axe-core could not run on {url}; it may be blocked by a Content-Security-Policy. "
                            f"({exc.__class__.__name__})",
                            code="harvest_script_error",
                        ) from exc

                    violations = extract_violations(axe_results)
                    try:
                        raw_vitals: dict[str, Any] = await page.evaluate("() => window.__darkhouseVitals")
                    except (PlaywrightError, PlaywrightTimeoutError):
                        raw_vitals = {}
                    vitals = collect_vitals(raw_vitals)
                    return build_scan_result(url, scan_id, violations, vitals)
                finally:
                    await browser.close()
        except (PlaywrightError, PlaywrightTimeoutError) as exc:
            raise HarvestError(
                f"We couldn't reach {url}. It may be down, or the network is slow. ({exc.__class__.__name__})"
            ) from exc
    finally:
        if slot_acquired:
            _SCAN_SLOT.release()


async def run_scan_with_timeout(url: str, scan_id: str, timeout_seconds: float = 120.0) -> dict[str, Any]:
    """Run a harvest bounded by a wall-clock timeout so scans never hang indefinitely."""
    try:
        return await asyncio.wait_for(run_scan(url, scan_id), timeout=timeout_seconds)
    except asyncio.TimeoutError as exc:
        raise HarvestError(
            f"The scan of {url} timed out after {timeout_seconds:.0f}s.",
            code="timeout",
        ) from exc
