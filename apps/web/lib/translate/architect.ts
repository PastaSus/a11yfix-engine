import type { Violation } from "@/lib/scan";
import {
  TranslateError,
  chat,
  extractJsonArray,
  readAiConfig,
  resolveRetryConfig,
} from "./client";
import type {
  AnalystImpact,
  ArchitectPatch,
  AuditReport,
  ChatMessage,
  TranslateDeps,
} from "./client";

export {
  DEFAULT_AI_PROVIDER,
  DEFAULT_AI_MODEL,
  TranslateError,
} from "./client";
export type {
  ArchitectPatch,
  AuditReport,
  TranslateDeps,
} from "./client";

// Unified diffs are verbose: the Architect gets a larger token budget than the
// Analyst's 1024 so a full patch set fits one response for a typical report.
export const MAX_PATCH_TOKENS = 2048;

const PROPOSED_STATUS: ArchitectPatch["status"] = "proposed";

type ArchitectContext = AnalystImpact & { violation: Violation };

function buildArchitectPrompt(
  auditReport: AuditReport,
  impacts: ArchitectContext[],
): ChatMessage[] {
  const summary = impacts.map((entry) => ({
    violation_id: entry.violation_id,
    impact: entry.violation.impact,
    description: entry.violation.description,
    affectedNodeIds: entry.violation.nodes?.map((node) => node.nodeId) ?? [],
    business_problem: entry.business_problem,
    wcag_consequence: entry.wcag_consequence,
  }));

  return [
    {
      role: "system",
      content:
        "You are the Architect persona in an accessibility remediation platform. A developer " +
        "will review your output before any change is made, so propose production-ready, minimal " +
        "React and Tailwind CSS fixes only — never claim a patch has been applied. Each proposed " +
        "fix is a git-style unified diff plus a rationale that references the violation id and the " +
        "WCAG rule it addresses. Reply with a JSON array only, one object per violation, in the " +
        "exact same order as provided.",
    },
    {
      role: "user",
      content:
        `Propose a React/Tailwind fix for each prioritized accessibility violation found on ${auditReport.url} (scan ${auditReport.scanId}).\n` +
        `Violations (JSON, in priority order): ${JSON.stringify(summary)}\n\n` +
        `Return a JSON array with exactly ${impacts.length} objects, one per violation, in the same order as listed. ` +
        "Each object must have only these keys:\n" +
        "- diff: a git-style unified diff (---/+++ file headers, @@ hunk headers, '+' additions and '-' deletions) " +
        "as a single string, targeting React and Tailwind code\n" +
        "- rationale: a non-empty string referencing the violation id and the WCAG rule\n" +
        "- wcag_rule: the non-empty WCAG rule reference this patch addresses\n" +
        "Every field must be a non-empty string. No markdown, no commentary.",
    },
  ];
}

function isValidUnifiedDiff(diff: string): boolean {
  const lines = diff.split(/\r?\n/);
  const hasAddition = lines.some((line) => /^\+[^+]/.test(line));
  const hasDeletion = lines.some((line) => /^-[^-]/.test(line));
  return hasAddition && hasDeletion;
}

function parsePatchEntry(
  entry: unknown,
  violationId: string,
  index: number,
): ArchitectPatch {
  if (typeof entry !== "object" || entry === null) {
    throw invalidPatch(violationId, index);
  }
  const candidate = entry as Record<string, unknown>;
  if (typeof candidate.wcag_rule !== "string" || candidate.wcag_rule.trim() === "") {
    throw invalidPatch(violationId, index);
  }
  if (
    typeof candidate.rationale !== "string" ||
    candidate.rationale.trim() === "" ||
    !candidate.rationale.includes(violationId) ||
    !/\bWCAG\b/i.test(candidate.rationale)
  ) {
    throw invalidPatch(violationId, index);
  }
  if (typeof candidate.diff !== "string" || !isValidUnifiedDiff(candidate.diff)) {
    throw invalidPatch(violationId, index);
  }
  return {
    status: PROPOSED_STATUS,
    diff: candidate.diff,
    rationale: candidate.rationale,
    wcag_rule: candidate.wcag_rule,
  };
}

function invalidPatch(violationId: string, index: number): TranslateError {
  return new TranslateError(
    "translate_error",
    `The AI provider returned an invalid patch at position ${index} for violation ${violationId}.`,
  );
}

function parsePatches(content: string, impacts: AnalystImpact[]): ArchitectPatch[] {
  const entries = extractJsonArray(content);
  if (entries.length !== impacts.length) {
    throw new TranslateError(
      "translate_error",
      `The AI provider returned ${entries.length} patches for ${impacts.length} prioritized violations.`,
    );
  }
  return entries.map((entry, index) => parsePatchEntry(entry, impacts[index].violation_id, index));
}

export async function translateArchitect(
  auditReport: AuditReport,
  deps: TranslateDeps = {},
): Promise<AuditReport> {
  if (
    auditReport == null ||
    !Array.isArray(auditReport.violations) ||
    !Array.isArray(auditReport.analyst_impacts)
  ) {
    throw new TranslateError("translate_error", "Invalid audit report.");
  }
  const impacts = auditReport.analyst_impacts;
  const violationById = new Map(auditReport.violations.map((violation) => [violation.id, violation]));
  for (const impact of impacts) {
    if (!violationById.has(impact.violation_id)) {
      throw new TranslateError(
        "translate_error",
        `The audit report references impact ${impact.violation_id} with no matching scan violation.`,
      );
    }
  }

  const fetchLike = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;
  const config = readAiConfig();
  const start = now();

  console.log("[darkhouse] translate start", {
    scanId: auditReport.scanId,
    provider: config.provider,
    model: config.model,
    patchCount: impacts.length,
  });

  try {
    let patches: ArchitectPatch[];
    if (impacts.length === 0) {
      patches = [];
    } else {
      const contexts = impacts.map((impact) => ({
        ...impact,
        violation: violationById.get(impact.violation_id)!,
      }));
      const content = await chat(
        config,
        buildArchitectPrompt(auditReport, contexts),
        MAX_PATCH_TOKENS,
        fetchLike,
        resolveRetryConfig(deps),
      );
      patches = parsePatches(content, impacts);
    }

    const durationMs = now() - start;
    console.log("[darkhouse] translate end", {
      scanId: auditReport.scanId,
      durationMs,
      architectPatches: patches.length,
    });
    return { ...auditReport, architect_patches: patches };
  } catch (error) {
    const durationMs = now() - start;
    const translateError =
      error instanceof TranslateError
        ? error
        : new TranslateError("translate_error", error instanceof Error ? error.message : String(error));
    console.error("[darkhouse] translate error", {
      scanId: auditReport.scanId,
      durationMs,
      code: translateError.code,
      message: translateError.message,
    });
    throw translateError;
  }
}
