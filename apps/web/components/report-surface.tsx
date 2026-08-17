"use client";

import { useCallback, useId, useMemo, useState } from "react";
import { AudienceToggle, persistAudience, type Audience } from "@/components/audience-toggle";
import { ClientView } from "@/components/client-view";
import { DeveloperView } from "@/components/developer-view";
import {
  TIER_CHIP,
  TIER_LABELS,
  TIER_ORDER,
  countPhrase,
  countTiers,
  type TierCounts,
} from "@/lib/severity";
import type { AuditReport } from "@/lib/translate/client";

type HealthTone = "critical" | "moderate" | "conforming";

const HEALTH_CHIP: Record<HealthTone, string> = {
  critical: "bg-critical-container text-on-critical-container",
  moderate: "bg-moderate-container text-on-moderate-container",
  conforming: "bg-conforming-container text-on-conforming-container",
};

function healthFor(counts: TierCounts): { label: string; tone: HealthTone } {
  if (counts.critical > 0) {
    return { label: countPhrase(counts.critical, "critical"), tone: "critical" };
  }
  if (counts.moderate > 0) {
    return {
      label: counts.minor > 0 ? "Moderate and minor issues" : "Moderate issues",
      tone: "moderate",
    };
  }
  if (counts.minor > 0) {
    return { label: "Minor issues", tone: "conforming" };
  }
  return { label: "No critical issues", tone: "conforming" };
}

function formatScanDate(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleDateString("en-US", {
    timeZone: "UTC",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ReportSurface({ report }: { report: AuditReport }) {
  const [audience, setAudience] = useState<Audience>("client");
  const [pendingViewFix, setPendingViewFix] = useState<string | null>(null);
  const titleId = useId();
  const counts = useMemo(() => countTiers(report.violations), [report.violations]);
  const health = healthFor(counts);

  function handleViewFix(violationId: string) {
    setPendingViewFix(violationId);
    persistAudience("developer");
    setAudience("developer");
  }

  // Each view-fix press must move focus exactly once. The developer view
  // reports back (via onPendingConsumed) once it has run its scroll+focus
  // move, and that report clears the pending id here — so a later manual
  // Client → Developer toggle has no stale id left to re-focus, but a fresh
  // press on the same row re-arms the move because the id was cleared.
  const handlePendingConsumed = useCallback(() => {
    setPendingViewFix(null);
  }, []);

  return (
    <section
      aria-labelledby={titleId}
      data-pending-view-fix={pendingViewFix ?? undefined}
      className="bg-surface text-on-surface"
    >
      <div className="mx-auto w-full max-w-report px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3 border-b border-outline pb-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-all text-2xl font-semibold leading-tight">
              {report.url}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              <span className="font-medium text-on-surface">Scanned</span>{" "}
              {formatScanDate(report.timestamp)}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${HEALTH_CHIP[health.tone]}`}
            >
              {health.label}
            </span>
            <button
              type="button"
              className="h-11 rounded-md border border-outline px-4 text-sm font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            >
              Export report
            </button>
          </div>
        </header>

        <div
          role="group"
          aria-label="Severity counts"
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          {TIER_ORDER.map((tier) => (
            <span
              key={tier}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${TIER_CHIP[tier]}`}
            >
              <span className="text-lg font-semibold tabular-nums leading-none">
                {counts[tier]}
              </span>
              {" "}
              {TIER_LABELS[tier]}
            </span>
          ))}
        </div>

        <div className="mt-6">
          <AudienceToggle value={audience} onChange={setAudience} />
        </div>

        {audience === "client" ? (
          <ClientView report={report} onViewFix={handleViewFix} />
        ) : (
          <DeveloperView
            report={report}
            pendingViewFix={pendingViewFix}
            onPendingConsumed={handlePendingConsumed}
          />
        )}
      </div>
    </section>
  );
}