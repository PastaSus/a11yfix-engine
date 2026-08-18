import { TranslateError } from "@/lib/translate/client";
import { translateAnalyst } from "@/lib/translate/analyst";
import { translateArchitect } from "@/lib/translate/architect";
import { isScanResult } from "@/lib/scan";

const INVALID_BODY = Response.json(
  { code: "invalid_scan", message: "Request body must be JSON: { \"scan\": { ... } }", stage: "translate" },
  { status: 400 },
);

export async function POST(request: Request) {
  let scan: unknown;
  try {
    ({ scan } = await request.json());
  } catch {
    return INVALID_BODY;
  }

  if (!isScanResult(scan)) {
    return INVALID_BODY;
  }

  try {
    const audited = await translateAnalyst(scan);
    const report = await translateArchitect(audited);
    return Response.json(report);
  } catch (error) {
    if (error instanceof TranslateError && error.code === "rate_limited") {
      return Response.json(
        { code: "rate_limited", message: error.message, stage: "translate" },
        { status: 503 },
      );
    }
    const message = error instanceof Error ? error.message : "The AI translation layer failed.";
    return Response.json(
      { code: "translate_error", message, stage: "translate" },
      { status: 502 },
    );
  }
}