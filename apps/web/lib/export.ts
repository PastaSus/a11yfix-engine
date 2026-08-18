import {
  TIER_LABELS,
  TIER_ORDER,
  countPhrase,
  countTiers,
  type TierCounts,
} from "@/lib/severity";
import type { AuditReport } from "@/lib/translate/client";

type HealthTone = "critical" | "moderate" | "conforming";

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

function isoDate(timestamp: string): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? "unknown-date" : date.toISOString().slice(0, 10);
}

function hostnameSlug(url: string): string {
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    const match = /^https?:\/\/([^/?#]+)/.exec(url);
    hostname = match ? match[1] : "site";
  }
  return hostname.replace(/\./g, "-");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function exportFilename(report: AuditReport): string {
  return `darkhouse-report-${hostnameSlug(report.url)}-${isoDate(report.timestamp)}.html`;
}

const EMBEDDED_CSS = `
:root {
  --surface: #f8fafc;
  --surface-container: #f1f5f9;
  --surface-container-high: #e2e8f0;
  --on-surface: #0f172a;
  --on-surface-variant: #475569;
  --outline: #64748b;
  --critical-container: #fee2e2;
  --on-critical-container: #7f1d1d;
  --moderate-container: #fef3c7;
  --on-moderate-container: #78350f;
  --minor-container: #e2e8f0;
  --on-minor-container: #334155;
  --conforming-container: #ccfbf1;
  --on-conforming-container: #134e4a;
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--surface);
  color: var(--on-surface);
  font-family: "Inter", "Segoe UI", system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
.report { max-width: 1040px; margin: 0 auto; padding: 24px 16px; }
@media (min-width: 640px) { .report { padding: 24px 32px; } }
.doc-header { border-bottom: 1px solid var(--outline); padding-bottom: 16px; }
.doc-header h1 {
  margin: 0;
  font-size: 24px;
  font-weight: 700;
  line-height: 1.3;
  word-break: break-all;
}
.doc-header .scanned { margin: 4px 0 12px; color: var(--on-surface-variant); font-size: 14px; }
.chip {
  display: inline-flex;
  align-items: center;
  border-radius: 9999px;
  padding: 4px 12px;
  font-size: 14px;
  font-weight: 600;
}
.chip-critical { background: var(--critical-container); color: var(--on-critical-container); }
.chip-moderate { background: var(--moderate-container); color: var(--on-moderate-container); }
.chip-conforming { background: var(--conforming-container); color: var(--on-conforming-container); }
.card {
  margin-top: 24px;
  border: 1px solid var(--outline);
  border-radius: 0.5rem;
  background: var(--surface-container);
  padding: 24px;
}
.card h2 { margin: 0 0 16px; font-size: 20px; font-weight: 600; }
.metrics { display: grid; grid-template-columns: 1fr; gap: 12px; }
@media (min-width: 640px) { .metrics { grid-template-columns: repeat(3, 1fr); } }
.metric-tile { border-radius: 0.5rem; padding: 16px; }
.tile-critical { background: var(--critical-container); color: var(--on-critical-container); }
.tile-moderate { background: var(--moderate-container); color: var(--on-moderate-container); }
.tile-minor { background: var(--minor-container); color: var(--on-minor-container); }
.metric-figure {
  display: block;
  font-size: 36px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.metric-label { display: block; margin-top: 4px; font-size: 14px; font-weight: 500; }
.note { margin: 12px 0 0; color: var(--on-surface-variant); font-size: 14px; }
ol.priority { margin: 8px 0 0; padding: 0; list-style: none; }
ol.priority li { border-bottom: 1px solid var(--outline); padding: 16px 0; }
ol.priority li:last-child { border-bottom: 0; padding-bottom: 0; }
.priority h3 { margin: 0; font-size: 16px; font-weight: 600; }
dl.impact { margin: 8px 0 0; display: grid; gap: 4px; font-size: 14px; }
dl.impact dt {
  color: var(--on-surface-variant);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}
dl.impact dd { margin: 2px 0 0; }
.mono, code { font-family: "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
`;

function renderMetrics(counts: TierCounts): string {
  return TIER_ORDER.map(
    (tier) => `<div role="group" aria-label="${escapeHtml(countPhrase(counts[tier], tier))}" class="metric-tile tile-${tier}">
        <span class="metric-figure">${counts[tier]}</span>
        <span class="metric-label">${TIER_LABELS[tier]}</span>
      </div>`,
  ).join("\n");
}

function renderImpacts(report: AuditReport): string {
  return report.analyst_impacts
    .map(
      (impact) => `<li>
        <h3>${escapeHtml(impact.business_problem)}</h3>
        <dl class="impact">
          <div>
            <dt>Affected users</dt>
            <dd>${escapeHtml(impact.affected_segment)}</dd>
          </div>
          <div>
            <dt>WCAG consequence</dt>
            <dd>${escapeHtml(impact.wcag_consequence)}</dd>
          </div>
          <div>
            <dt>Business impact</dt>
            <dd>${escapeHtml(impact.conversion_impact_estimate)}</dd>
          </div>
        </dl>
      </li>`,
    )
    .join("\n");
}

export function renderReportHtml(report: AuditReport): string {
  const counts = countTiers(report.violations);
  const health = healthFor(counts);
  const hasCritical = counts.critical > 0;
  const hasImpacts = report.analyst_impacts.length > 0;

  let priorityBody: string;
  if (!hasCritical) {
    priorityBody = `<p class="note">No critical violations detected. Check the Developer view for the full report.</p>`;
  } else if (!hasImpacts) {
    priorityBody = `<p class="note">Impact analysis unavailable — see the Developer view.</p>`;
  } else {
    priorityBody = `<ol class="priority">\n${renderImpacts(report)}\n</ol>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Darkhouse — Diagnostic Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap"
      rel="stylesheet"
    />
    <style>${EMBEDDED_CSS}
    </style>
  </head>
  <body>
    <main class="report">
      <header class="doc-header">
        <h1>${escapeHtml(report.url)}</h1>
        <p class="scanned">Scanned ${escapeHtml(formatScanDate(report.timestamp))}</p>
        <span class="chip chip-${health.tone}">${escapeHtml(health.label)}</span>
      </header>
      <section class="card" aria-label="Executive summary severity counts">
        <h2>Executive summary</h2>
        <div class="metrics">
${renderMetrics(counts)}
        </div>
      </section>
      <section class="card" aria-label="Priority issues">
        <h2>Priority issues</h2>
        ${priorityBody}
      </section>
    </main>
  </body>
</html>`;
}

export function triggerExport(html: string, filename: string): void {
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke even if the anchor click (or anything before it) throws, so the
    // object URL never leaks; the error still propagates to the caller's catch.
    URL.revokeObjectURL(url);
  }
}