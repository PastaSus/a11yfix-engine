import type { Violation, ViolationNode } from "@/lib/scan";
import type { AnalystImpact, ArchitectPatch, AuditReport } from "@/lib/translate/client";

export function makeViolation(
  impact: Violation["impact"],
  id: string,
  nodes: ViolationNode[] = [],
): Violation {
  return {
    id,
    impact,
    description: `Violation ${id}`,
    helpUrl: "https://dequeuniversity.com/rules/axe/4.11/button-name",
    nodes,
  };
}

export function makePatch(
  diff = `--- a/src/components/Card.tsx
+++ b/src/components/Card.tsx
@@ -1 +1,4 @@
-  <img className="h-40 w-full object-cover" />
+  <img
+    className="h-40 w-full object-cover"
+    alt="Product image"
+  />
`,
  fields: Partial<ArchitectPatch> = {},
): ArchitectPatch {
  return {
    status: "proposed",
    diff,
    rationale: "Adds descriptive alt text to product images, addressing violation v-1 (WCAG 1.1.1).",
    wcag_rule: "WCAG 1.1.1",
    ...fields,
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
  architectPatches: ArchitectPatch[] = [],
): AuditReport {
  return {
    schemaVersion: "1.0.0",
    scanId: "01J123456789ABCDEFGHJKLMNP",
    url: "https://example.com",
    violations,
    vitals: { lcp: 1200, inp: null, cls: 0.1 },
    timestamp: "2026-08-15T12:30:00.000Z",
    analyst_impacts: analystImpacts,
    architect_patches: architectPatches,
  };
}