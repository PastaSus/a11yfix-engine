"use client";

import { Fragment, useEffect, useId, useRef, useState } from "react";
import { DiffViewer } from "@/components/diff-viewer";
import { TIER_CHIP, TIER_LABELS, severityTier } from "@/lib/severity";
import type { Violation } from "@/lib/scan";
import type { AuditReport } from "@/lib/translate/client";

type SortKey = "severity" | "rule" | "nodes";
type SortState = { key: SortKey; direction: "asc" | "desc" };

const DEFAULT_SORT: Record<SortKey, "asc" | "desc"> = {
  severity: "desc",
  rule: "asc",
  nodes: "desc",
};

const SEVERITY_MAGNITUDE: Record<Violation["impact"], number> = {
  minor: 0,
  moderate: 1,
  serious: 2,
  critical: 3,
};

const VITALS_METRICS: { key: "lcp" | "inp" | "cls"; label: string; unit: string }[] = [
  { key: "lcp", label: "LCP", unit: "ms" },
  { key: "inp", label: "INP", unit: "ms" },
  { key: "cls", label: "CLS", unit: "" },
];

function compareViolations(a: Violation, b: Violation, key: SortKey): number {
  switch (key) {
    case "severity":
      return SEVERITY_MAGNITUDE[a.impact] - SEVERITY_MAGNITUDE[b.impact];
    case "rule":
      return a.id.localeCompare(b.id);
    case "nodes":
      return a.nodes.length - b.nodes.length;
    default:
      return 0;
  }
}

function SortIndicator({ active, direction }: { active: boolean; direction: "asc" | "desc" }) {
  if (!active) {
    return (
      <span aria-hidden="true" className="ml-1 text-[10px] leading-none text-on-surface-variant">
        {"\u25B2\u25BC"}
      </span>
    );
  }
  return (
    <span aria-hidden="true" className="ml-1 text-[10px] leading-none">
      {direction === "asc" ? "\u25B2" : "\u25BC"}
    </span>
  );
}

function ariaSort(state: SortState, key: SortKey): "ascending" | "descending" | "none" {
  if (state.key !== key) return "none";
  return state.direction === "asc" ? "ascending" : "descending";
}

export function DeveloperView({
  report,
  pendingViewFix,
  onPendingConsumed,
}: {
  report: AuditReport;
  pendingViewFix: string | null;
  onPendingConsumed?: () => void;
}) {
  const [sort, setSort] = useState<SortState>({ key: "severity", direction: "desc" });
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const detailPrefix = useId();

  const rows = report.violations
    .map((violation, index) => ({ violation, index }))
    .sort(({ violation: a, index: aIndex }, { violation: b, index: bIndex }) => {
      const cmp = compareViolations(a, b, sort.key);
      if (cmp !== 0) return sort.direction === "asc" ? cmp : -cmp;
      return aIndex - bIndex;
    })
    .map(({ violation }) => violation);

  function toggleSort(key: SortKey) {
    setSort((previous) =>
      previous.key === key
        ? { key, direction: previous.direction === "asc" ? "desc" : "asc" }
        : { key, direction: DEFAULT_SORT[key] },
    );
  }

  function toggleExpanded(id: string) {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  useEffect(() => {
    if (!pendingViewFix) return;
    const row = rowRefs.current.get(pendingViewFix);
    if (row) {
      // The single intentional, user-initiated focus move from a "view fix"
      // press: scroll the matching violation row into view and focus it. No
      // animation, no smooth scrolling — instant, then stays put.
      row.scrollIntoView?.({ behavior: "instant", block: "nearest" });
      row.focus({ preventScroll: true });
    }
    // This press has been consumed (focused or unresolvable): report back so
    // the surface clears the id and a later manual toggle cannot re-move.
    onPendingConsumed?.();
  }, [pendingViewFix, onPendingConsumed]);

  return (
    <section aria-label="Developer view" className="grid gap-6 pt-6">
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-md border border-outline bg-surface">
          <h3 className="px-4 pb-2 pt-4 text-lg font-semibold">Violations</h3>
          <div className="overflow-x-auto pb-2">
            <table
              aria-label="Violations"
              className="w-full min-w-[640px] border-collapse text-sm"
            >
            <thead>
              <tr className="border-b border-outline bg-surface-container text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                <th scope="col" className="px-3 text-left">
                  <span className="sr-only">Toggle details</span>
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "rule")} className="px-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort("rule")}
                    className="inline-flex h-11 items-center rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Rule
                    <SortIndicator active={sort.key === "rule"} direction={sort.direction} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "severity")} className="px-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort("severity")}
                    className="inline-flex h-11 items-center rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Severity
                    <SortIndicator active={sort.key === "severity"} direction={sort.direction} />
                  </button>
                </th>
                <th scope="col" aria-sort={ariaSort(sort, "nodes")} className="px-3 text-left">
                  <button
                    type="button"
                    onClick={() => toggleSort("nodes")}
                    className="inline-flex h-11 items-center rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  >
                    Nodes
                    <SortIndicator active={sort.key === "nodes"} direction={sort.direction} />
                  </button>
                </th>
                <th scope="col" className="px-3 text-left">
                  <span className="inline-flex h-11 items-center px-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    Affected node
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-sm text-on-surface-variant">
                    No violations detected
                  </td>
                </tr>
              ) : (
                rows.map((violation) => {
                  const tier = severityTier(violation.impact);
                  const isExpanded = expandedIds.has(violation.id);
                  const detailId = `${detailPrefix}-detail-${violation.id}`;
                  return (
                    <Fragment key={violation.id}>
                      <tr
                        data-violation-row={violation.id}
                        tabIndex={-1}
                        onClick={() => toggleExpanded(violation.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            toggleExpanded(violation.id);
                          }
                        }}
                        ref={(element) => {
                          if (element) {
                            rowRefs.current.set(violation.id, element);
                          } else {
                            rowRefs.current.delete(violation.id);
                          }
                        }}
                        className="cursor-pointer border-b border-outline/60 last:border-b-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      >
                        <td className="px-3 py-0">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={detailId}
                            aria-label={`${isExpanded ? "Hide" : "Show"} details for ${violation.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleExpanded(violation.id);
                            }}
                            className="h-11 rounded-md px-2 text-sm font-medium text-on-surface hover:bg-surface-container focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                          >
                            {isExpanded ? "Hide" : "Show"}
                          </button>
                        </td>
                        <td className="px-3 py-0">
                          <span className="inline-flex items-center whitespace-nowrap rounded-full border border-outline bg-surface-container-high px-2.5 py-0.5 font-mono text-xs">
                            {violation.id}
                          </span>
                        </td>
                        <td className="px-3 py-0">
                          <span
                            className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TIER_CHIP[tier]}`}
                          >
                            {TIER_LABELS[tier]}
                          </span>
                        </td>
                        <td className="px-3 py-0 tabular-nums">{violation.nodes.length}</td>
                        <td className="px-3 py-0">
                          {violation.nodes.length === 0 ? (
                            <span className="text-sm text-on-surface-variant">{"\u2014"}</span>
                          ) : (
                            <span className="inline-block max-w-[16rem] truncate align-middle font-mono text-xs text-on-surface-variant">
                              {violation.nodes[0].nodeId}
                            </span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="border-b border-outline/60 last:border-b-0">
                          <td colSpan={5} className="bg-surface-container/50 px-3 py-3">
                            <div id={detailId}>
                              <p className="text-sm">{violation.description}</p>
                              {violation.helpUrl && (
                                <a
                                  href={violation.helpUrl}
                                  className="mt-2 inline-block text-sm font-medium text-on-surface underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                                >
                                  Learn more at axe
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-md border border-outline bg-surface-container p-4">
          <h3 className="text-lg font-semibold">Core Web Vitals</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            {VITALS_METRICS.map(({ key, label, unit }) => {
              const value = report.vitals[key];
              const measured = value !== null;
              return (
                <div
                  key={key}
                  role="group"
                  aria-label={
                    measured ? `${label}: ${value}${unit ? ` ${unit}` : ""}` : `${label}: not measured`
                  }
                  className="rounded-lg border border-outline bg-surface p-4"
                >
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                    {label}
                  </h4>
                  <p className="mt-1 flex items-baseline gap-1.5">
                    <span aria-hidden="true" className="text-3xl font-bold leading-none tabular-nums">
                      {measured ? value : "\u2014"}
                    </span>
                    {unit && (
                      <span aria-hidden="true" className="text-sm text-on-surface-variant">
                        {unit}
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-md border border-outline bg-surface p-4">
          <h3 className="text-lg font-semibold">Proposed fixes</h3>
          {report.architect_patches.length === 0 ? (
            <p className="mt-3 text-sm text-on-surface-variant">No generated patches</p>
          ) : (
            <div className="mt-4 grid gap-6">
              {report.architect_patches.map((patch, index) => (
                <article key={index} className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center rounded-full border border-outline bg-surface-container px-2.5 py-0.5 font-mono text-xs font-medium">
                      {patch.wcag_rule}
                    </span>
                  </div>
                  <p className="text-sm text-on-surface-variant">{patch.rationale}</p>
                  <DiffViewer patch={patch} />
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>
    </section>
  );
}