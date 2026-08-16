import type { Violation } from "@/lib/scan";

export type SeverityTier = "critical" | "moderate" | "minor";

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