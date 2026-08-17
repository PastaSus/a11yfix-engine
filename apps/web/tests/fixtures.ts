import type { Violation } from "@/lib/scan";
import type { AnalystImpact, AuditReport } from "@/lib/translate/client";

export function makeViolation(impact: Violation["impact"], id: string): Violation {
  return {
    id,
    impact,
    description: `Violation ${id}`,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.11/button-name",
    nodes: [],
  };
}

export function makeImpact(
  violationId: string,
  fields: Partial<AnalystImpact> = {},
): AnalystImpact {
  return {
    violation_id: violationId,
    business_problem: `Human problem for ${violationId}.`,
    affected_segment: `Affected users for ${violationId}.`,
    wcag_consequence: `WCAG consequence for ${violationId}.`,
    conversion_impact_estimate: `Roughly N% of sessions for ${violationId}.`,
    ...fields,
  };
}

export function makeReport(
  violations: Violation[],
  analystImpacts: AnalystImpact[] = [],
): AuditReport {
  return {
    schemaVersion: "1.0.0",
    scanId: "01J123456789ABCDEFGHJKLMNP",
    url: "https://example.com",
    violations,
    vitals: { lcp: 1200, inp: null, cls: 0.1 },
    timestamp: "2026-08-15T12:30:00.000Z",
    analyst_impacts: analystImpacts,
    architect_patches: [],
  };
}