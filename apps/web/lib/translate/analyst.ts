import type { ScanResult, Violation } from "@/lib/scan";
import {
  TranslateError,
  chat,
  extractJsonArray,
  readAiConfig,
} from "./client";
import type { AnalystImpact, AuditReport, ChatMessage, TranslateDeps } from "./client";

export {
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODEL,
  TranslateError,
} from "./client";
export type {
  AnalystImpact,
  ArchitectPatch,
  AuditReport,
  TranslateDeps,
} from "./client";

const MAX_TOKENS = 1024;
const HIGH_IMPACTS = ["critical", "serious"] as const;
const SEVERITY_WEIGHT: Record<string, number> = { critical: 0, serious: 1 };

function highSeverityViolations(scanResult: ScanResult): Violation[] {
  const highImpacts: readonly string[] = HIGH_IMPACTS;
  return scanResult.violations.filter((violation) => highImpacts.includes(violation.impact));
}

function buildTranslatePrompt(scanResult: ScanResult, violations: Violation[]): ChatMessage[] {
  const summary = violations.map((violation) => ({
    id: violation.id,
    impact: violation.impact,
    description: violation.description,
    affectedNodeCount: violation.nodes?.length ?? 0,
  }));

  return [
    {
      role: "system",
      content:
        "You are the Analyst persona in an accessibility remediation platform. A non-technical " +
        "stakeholder will read your output, so explain each accessibility failure in plain " +
        "business English with the affected user segment and the WCAG requirement it violates. " +
        "Never overclaim causal attribution: every estimate must be hedged with language such as " +
        "'plausibly', 'may', or 'roughly'. Reply with a JSON array only, one object per violation_id.",
    },
    {
      role: "user",
      content:
        `Translate these high-severity accessibility violations found on ${scanResult.url} into business impact.\n` +
        `Violations (JSON): ${JSON.stringify(summary)}\n\n` +
        "Return a JSON array with exactly one object per violation. Each object must have only these keys:\n" +
        "- violation_id: the source violation id\n" +
        "- business_problem: the human-facing failure in plain English\n" +
        "- affected_segment: which users are most affected\n" +
        "- wcag_consequence: the WCAG reference and its consequence\n" +
        "- conversion_impact_estimate: a reasoned, hedged estimate of the business impact\n" +
        "Every field must be a non-empty string. No markdown, no commentary.",
    },
  ];
}

function isValidImpact(candidate: Record<string, unknown>): boolean {
  const fields = ["business_problem", "affected_segment", "wcag_consequence", "conversion_impact_estimate"] as const;
  return fields.every((field) => typeof candidate[field] === "string" && candidate[field].trim() !== "");
}

function parseImpacts(content: string, violations: Violation[]): AnalystImpact[] {
  const expected = new Set(violations.map((violation) => violation.id));
  const entries = extractJsonArray(content);
  const byId = new Map<string, AnalystImpact>();

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const candidate = entry as Record<string, unknown>;
    if (typeof candidate.violation_id !== "string") continue;
    if (!expected.has(candidate.violation_id)) continue;
    if (byId.has(candidate.violation_id)) continue;
    if (!isValidImpact(candidate)) {
      throw new TranslateError(
        "translate_error",
        `The AI provider returned an incomplete impact block for ${candidate.violation_id}.`,
      );
    }
    byId.set(candidate.violation_id, {
      violation_id: candidate.violation_id,
      business_problem: candidate.business_problem as string,
      affected_segment: candidate.affected_segment as string,
      wcag_consequence: candidate.wcag_consequence as string,
      conversion_impact_estimate: candidate.conversion_impact_estimate as string,
    });
  }

  for (const violation of violations) {
    if (!byId.has(violation.id)) {
      throw new TranslateError("translate_error", `No impact block was returned for violation ${violation.id}.`);
    }
  }

  return [...byId.values()];
}

function rankImpacts(blocks: AnalystImpact[], violations: Violation[]): AnalystImpact[] {
  const severityById = new Map(
    violations.map((violation) => [violation.id, SEVERITY_WEIGHT[violation.impact] ?? SEVERITY_WEIGHT.serious]),
  );
  return [...blocks].sort((a, b) => {
    const weightA = severityById.get(a.violation_id) ?? SEVERITY_WEIGHT.serious;
    const weightB = severityById.get(b.violation_id) ?? SEVERITY_WEIGHT.serious;
    if (weightA !== weightB) return weightA - weightB;
    return a.violation_id < b.violation_id ? -1 : a.violation_id > b.violation_id ? 1 : 0;
  });
}

function buildAuditReport(scanResult: ScanResult, analystImpacts: AnalystImpact[]): AuditReport {
  return {
    schemaVersion: scanResult.schemaVersion,
    scanId: scanResult.scanId,
    url: scanResult.url,
    violations: scanResult.violations,
    vitals: scanResult.vitals,
    timestamp: scanResult.timestamp,
    analyst_impacts: analystImpacts,
    architect_patches: [],
  };
}

export async function translateAnalyst(
  scanResult: ScanResult,
  deps: TranslateDeps = {},
): Promise<AuditReport> {
  if (scanResult == null || !Array.isArray(scanResult.violations)) {
    throw new TranslateError("translate_error", "Invalid scan result.");
  }
  const fetchLike = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;
  const config = readAiConfig();
  const violations = highSeverityViolations(scanResult);
  const start = now();

  console.log("[darkhouse] translate start", {
    scanId: scanResult.scanId,
    provider: config.provider,
    model: config.model,
    highSeverityCount: violations.length,
  });

  try {
    let analystImpacts: AnalystImpact[];
    if (violations.length === 0) {
      analystImpacts = [];
    } else {
      const content = await chat(config, buildTranslatePrompt(scanResult, violations), MAX_TOKENS, fetchLike);
      analystImpacts = rankImpacts(parseImpacts(content, violations), violations);
    }

    const durationMs = now() - start;
    console.log("[darkhouse] translate end", {
      scanId: scanResult.scanId,
      durationMs,
      analystImpacts: analystImpacts.length,
    });
    return buildAuditReport(scanResult, analystImpacts);
  } catch (error) {
    const durationMs = now() - start;
    const translateError =
      error instanceof TranslateError
        ? error
        : new TranslateError("translate_error", error instanceof Error ? error.message : String(error));
    console.error("[darkhouse] translate error", {
      scanId: scanResult.scanId,
      durationMs,
      code: translateError.code,
      message: translateError.message,
    });
    throw translateError;
  }
}
