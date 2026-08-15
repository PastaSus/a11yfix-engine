"""Shared pytest fixtures for the scanner test suite.

`s spa_fixture_server` is a session-scoped ThreadingHTTPServer (stdlib, fully
offline) on an ephemeral port serving the `fixtures/` directory, with two extra
routes used by the SPA-render fixtures:

- `/slow` responds after ~1.2s, keeping a connection in flight long enough for
  deferred DOM content to render before Playwright sees network idle.
- `/hold` streams an open response indefinitely, so network idle never fires
  and the DOM-stability fallback / timeout path is genuinely exercised.

Teardown stops the server; held connections are tolerated because the handler
threads are daemonic and exit on the next write once the browser is closed.
"""

from __future__ import annotations

import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import pytest

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


class SPAFixtureHandler(SimpleHTTPRequestHandler):
    """Serve the fixtures dir plus the `/slow` and `/hold` behavior routes."""

    def __init__(self, *args: object, **kwargs: object) -> None:
        super().__init__(*args, directory=str(FIXTURES_DIR), **kwargs)

    def do_GET(self) -> None:
        path = self.path.split("?")[0]
        if path == "/slow":
            time.sleep(1.2)
            body = b"ok"
            self.send_response(200)
            self.send_header("Content-Type", "text/plain")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        if path == "/hold":
            self.send_response(200)
            self.end_headers()
            try:
                while True:
                    self.wfile.write(b"x")
                    self.wfile.flush()
                    time.sleep(0.5)
            except (BrokenPipeError, ConnectionResetError, OSError):
                pass
            return
        super().do_GET()

    def log_message(self, *args: object) -> None:
        pass


@pytest.fixture(scope="session")
def spa_fixture_server() -> "object":
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), SPAFixtureHandler)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    host, port = httpd.server_address
    yield f"http://{host}:{port}"
    httpd.shutdown()
    httpd.server_close()
    thread.join(timeout=5)