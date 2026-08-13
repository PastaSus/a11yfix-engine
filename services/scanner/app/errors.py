"""Typed error shapes and FastAPI exception handlers for the scanner service.

Every error leaving the service is the `{ code, message, stage }` envelope
(ADR-8). HTTP status reflects severity: validation errors -> 400, harvest
errors -> 502.
"""

from __future__ import annotations

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class ScanError(Exception):
    """Base typed error. Carries the canonical `{ code, message, stage }` shape."""

    code = "scan_error"
    stage = "harvest"
    status_code = 500

    def __init__(self, message: str, *, code: str | None = None) -> None:
        super().__init__(message)
        self.message = message
        if code is not None:
            self.code = code

    def to_dict(self) -> dict[str, str]:
        return {"code": self.code, "message": self.message, "stage": self.stage}


class ValidationError(ScanError):
    """Malformed or insecure input rejected before any browser launch."""

    code = "invalid_url"
    stage = "validate"
    status_code = 400


class HarvestError(ScanError):
    """The page could not be harvested (unreachable host, DNS, timeout, etc.)."""

    code = "unreachable"
    stage = "harvest"
    status_code = 502


def register_exception_handlers(app: FastAPI) -> None:
    """Wire `{ code, message, stage }` handlers for all ScanError subclasses."""

    @app.exception_handler(ValidationError)
    async def _handle_validation_error(request: Request, exc: ValidationError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(HarvestError)
    async def _handle_harvest_error(request: Request, exc: HarvestError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(ScanError)
    async def _handle_scan_error(request: Request, exc: ScanError) -> JSONResponse:
        return JSONResponse(status_code=exc.status_code, content=exc.to_dict())

    @app.exception_handler(RequestValidationError)
    async def _handle_request_validation_error(
        request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        return JSONResponse(
            status_code=422,
            content={
                "code": "invalid_request",
                "message": "The request body failed validation.",
                "stage": "validate",
            },
        )


__all__ = ["ScanError", "ValidationError", "HarvestError", "register_exception_handlers"]
