const SCANNER_URL = process.env.SCANNER_URL ?? "http://127.0.0.1:8000";
const SCAN_FETCH_TIMEOUT_MS = 130_000;

export async function POST(request: Request) {
  let url: unknown;
  try {
    ({ url } = await request.json());
  } catch {
    return Response.json(
      { code: "invalid_url", message: "Request body must be JSON: { \"url\": \"https://...\" }", stage: "validate" },
      { status: 400 },
    );
  }

  if (typeof url !== "string" || url.trim() === "") {
    return Response.json(
      { code: "invalid_url", message: "A URL is required.", stage: "validate" },
      { status: 400 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`${SCANNER_URL}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
      signal: AbortSignal.timeout(SCAN_FETCH_TIMEOUT_MS),
    });
  } catch {
    return Response.json(
      { code: "unreachable", message: "The scanner service is unavailable. Is it running on " + SCANNER_URL + "?", stage: "harvest" },
      { status: 502 },
    );
  }

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return new Response(text, { status: res.status });
  }

  return Response.json(data, { status: res.status });
}