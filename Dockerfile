FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml uv.lock ./
COPY services/scanner ./services/scanner
COPY contracts ./contracts

RUN uv sync --frozen --no-dev

RUN uv run playwright install --with-deps chromium

EXPOSE 8000

CMD ["sh", "-c", "uv run uvicorn services.scanner.app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]