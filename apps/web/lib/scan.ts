export type Vitals = {
  lcp: number | null;
  inp: number | null;
  cls: number | null;
};

export type ViolationNode = {
  nodeId: string;
  coordinates: { x: number; y: number; width: number; height: number } | null;
};

export type Violation = {
  id: string;
  impact: "critical" | "serious" | "moderate" | "minor";
  description: string;
  helpUrl: string | null;
  nodes: ViolationNode[];
};

export type Proof = {
  mimeType: string;
  dataBase64: string;
};

export type ScanResult = {
  schemaVersion: string;
  scanId: string;
  url: string;
  violations: Violation[];
  vitals: Vitals;
  timestamp: string;
  proof?: Proof | null;
};

export type SubmitScanError = {
  code: string;
  message: string;
  stage: string;
};

export type SubmitScanResult =
  | { ok: true; data: ScanResult }
  | { ok: false; code: string; message: string; status: number };

function isNullableNumber(value: unknown): value is number | null {
  return typeof value === "number" || value === null;
}

function isScanResult(data: unknown): data is ScanResult {
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
    typeof candidate.timestamp === "string"
  );
}

export async function submitScan(url: string): Promise<SubmitScanResult> {
  let res: globalThis.Response;
  try {
    res = await fetch("/api/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
  } catch {
    return {
      ok: false,
      code: "unreachable",
      message: "The scan service could not be reached.",
      status: 0,
    };
  }

  let data: Partial<SubmitScanError & ScanResult> & { code?: unknown; message?: unknown };
  try {
    data = (await res.json()) as typeof data;
  } catch {
    return {
      ok: false,
      code: "invalid_response",
      message: "The scan returned an unreadable response.",
      status: res.status,
    };
  }

  if (res.ok) {
    if (isScanResult(data)) {
      return { ok: true, data };
    }
    return {
      ok: false,
      code: "invalid_response",
      message: "The scan returned an unreadable response.",
      status: res.status,
    };
  }

  return {
    ok: false,
    code: typeof data.code === "string" ? data.code : "scan_error",
    message: typeof data.message === "string" ? data.message : "The scan failed.",
    status: res.status,
  };
}