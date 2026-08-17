"use client";

import { useMemo } from "react";
import {
  TIER_CHIP,
  TIER_LABELS,
  TIER_ORDER,
  countPhrase,
  countTiers,
} from "@/lib/severity";
import type { AuditReport } from "@/lib/translate/client";

type ClientViewProps = {
  report: AuditReport;
  onViewFix: (violationId: string) => void;
};

export function ClientView({ report, onViewFix }: ClientViewProps) {
  const counts = useMemo(() => countTiers(report.violations), [report.violations]);
  const hasCritical = counts.critical > 0;
  const hasImpacts = report.analyst_impacts.length > 0;

  return (
    <section aria-label="Client view" className="grid gap-6 pt-6 md:grid-cols-12">
      <div className="rounded-md border border-outline bg-surface-container p-6 md:col-span-7">
        <h3 className="text-lg font-semibold">Executive summary</h3>
        <div
          role="group"
          aria-label="Executive summary severity counts"
          className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3"
        >
          {TIER_ORDER.map((tier) => (
            <div
              key={tier}
              role="group"
              aria-label={countPhrase(counts[tier], tier)}
              className={`rounded-lg p-4 ${TIER_CHIP[tier]}`}
            >
              <span
                aria-hidden="true"
                className="block text-4xl font-bold leading-none tabular-nums"
              >
                {counts[tier]}
              </span>
              <span aria-hidden="true" className="mt-1 block text-sm font-medium">
                {TIER_LABELS[tier]}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-md border border-outline bg-surface-container p-6 md:col-span-5">
        <h3 className="text-lg font-semibold">Priority issues</h3>
        {!hasCritical && (
          <p className="mt-3 text-sm text-on-surface-variant">
            No critical violations detected. Check the Developer view for the full report.
          </p>
        )}
        {hasCritical && !hasImpacts && (
          <p className="mt-3 text-sm text-on-surface-variant">
            Impact analysis unavailable — see the Developer view.
          </p>
        )}
        {hasImpacts && (
          <ol className="mt-4">
            {report.analyst_impacts.map((impact) => (
              <li key={impact.violation_id} className="border-b border-outline py-4 last:border-b-0">
                <h4 className="text-base font-semibold">{impact.business_problem}</h4>
                <dl className="mt-2 grid gap-1 text-sm">
                  <div>
                    <dt className="text-on-surface-variant">Affected users</dt>
                    <dd className="mt-0.5">{impact.affected_segment}</dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">WCAG consequence</dt>
                    <dd className="mt-0.5">{impact.wcag_consequence}</dd>
                  </div>
                  <div>
                    <dt className="text-on-surface-variant">Business impact</dt>
                    <dd className="mt-0.5">{impact.conversion_impact_estimate}</dd>
                  </div>
                </dl>
                <button
                  type="button"
                  aria-label={`View fix: ${impact.business_problem}`}
                  onClick={() => onViewFix(impact.violation_id)}
                  className="mt-3 h-11 rounded-md border border-outline px-4 text-sm font-medium text-on-surface hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  View fix
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}