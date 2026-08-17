import type { Violation } from "@/lib/scan";

export type SeverityTier = "critical" | "moderate" | "minor";

export type TierCounts = Record<SeverityTier, number>;

const EMPTY_COUNTS: TierCounts = { critical: 0, moderate: 0, minor: 0 };

export const TIER_ORDER: SeverityTier[] = ["critical", "moderate", "minor"];

export const TIER_LABELS: Record<SeverityTier, string> = {
  critical: "Critical",
  moderate: "Moderate",
  minor: "Minor",
};

export const TIER_CHIP: Record<SeverityTier, string> = {
  critical: "bg-critical-container text-on-critical-container",
  moderate: "bg-moderate-container text-on-moderate-container",
  minor: "bg-minor-container text-on-minor-container",
};

export function severityTier(impact: Violation["impact"]): SeverityTier {
  switch (impact) {
    case "critical":
    case "serious":
      return "critical";
    case "moderate":
      return "moderate";
    case "minor":
      return "minor";
    default:
      // Out-of-vocabulary impact (vocabulary/schema drift beyond the frozen
      // four-value fold): land on the visible moderate tier so the violation is
      // never silently dropped and the health chip can never falsely claim
      // "No critical issues". The frozen axe mapping above stays untouched.
      return "moderate";
  }
}

export function countTiers(violations: Violation[]): TierCounts {
  const counts: TierCounts = { ...EMPTY_COUNTS };
  for (const violation of violations) {
    counts[severityTier(violation.impact)] += 1;
  }
  return counts;
}

export function countPhrase(count: number, tier: SeverityTier): string {
  return `${count} ${TIER_LABELS[tier].toLowerCase()} issue${count === 1 ? "" : "s"}`;
}