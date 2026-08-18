import type { ScanResult } from "@/lib/scan";
import type { AuditReport } from "@/lib/translate/client";

export type SubmitTranslateResult =
  | { ok: true; data: AuditReport }
  | { ok: false; code: string; message: string; status: number };

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isProofBlock(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.mimeType === "string" && typeof candidate.dataBase64 === "string";
}

export function isAuditReport(data: unknown): data is AuditReport {
  if (typeof data !== "object" || data === null) return false;
  const candidate = data as Record<string, unknown>;
  const vitals = candidate.vitals as Record<string, unknown> | null | undefined;
  return (
    typeof candidate.schemaVersion === "string" &&
    typeof candidate.scanId === "string" &&
    typeof candidate.url === "string" &&
    Array.isArray(candidate.violations) &&
    typeof vitals === "object" &&
    vitals !== null &&
    isNullableNumber(vitals.lcp) &&
    isNullableNumber(vitals.inp) &&
    isNullableNumber(vitals.cls) &&
    typeof candidate.timestamp === "string" &&
    Array.isArray(candidate.analyst_impacts) &&
    Array.isArray(candidate.architect_patches) &&
    isProofBlock(candidate.proof)
  );
}

export async function submitTranslate(scan: ScanResult): Promise<SubmitTranslateResult> {
  let res: globalThis.Response;
  try {
    res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scan }),
    });
  } catch {
    return {
      ok: false,
      code: "translate_error",
      message: "The translation service could not be reached.",
      status: 0,
    };
  }

  let data: unknown;
  try {
    data = await res.json();
  } catch {
    return {
      ok: false,
      code: "translate_error",
      message: "The translation service returned an unreadable response.",
      status: res.status,
    };
  }

  if (res.ok) {
    if (isAuditReport(data)) {
      return { ok: true, data };
    }
    return {
      ok: false,
      code: "translate_error",
      message: "The translation service returned an unreadable response.",
      status: res.status,
    };
  }

  const error = data as Record<string, unknown>;
  return {
    ok: false,
    code: typeof error.code === "string" ? error.code : "translate_error",
    message: typeof error.message === "string" ? error.message : "Translation failed.",
    status: res.status,
  };
}