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
  }
}