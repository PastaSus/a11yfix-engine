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

const FALLBACK_HOSTNAME = "site";

function parseHostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    const match = /^https?:\/\/([^/?#]+)/.exec(url);
    if (!match) return "";
    // Mirror `new URL(...).hostname`: drop the port so the fallback branch
    // produces the same host as the parsing branch on non-default ports.
    return match[1].replace(/:\d+$/, "");
  }
}

function hostnameSlug(url: string): string {
  const hostname = parseHostname(url) || FALLBACK_HOSTNAME;
  return hostname.replace(/\./g, "-");
}

export function hostnameOf(url: string): string {
  const hostname = parseHostname(url);
  return hostname === "" ? FALLBACK_HOSTNAME : hostname;
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
  --surface: oklch(0.973 0.006 85);
  --surface-container: oklch(0.952 0.008 85);
  --surface-container-high: oklch(0.917 0.009 85);
  --on-surface: oklch(0.235 0.018 85);
  --on-surface-variant: oklch(0.46 0.015 85);
  --outline: oklch(0.63 0.012 85);
  --critical-container: oklch(0.93 0.03 27);
  --on-critical-container: oklch(0.38 0.12 27);
  --moderate-container: oklch(0.95 0.04 80);
  --on-moderate-container: oklch(0.42 0.08 60);
  --minor-container: oklch(0.91 0.009 85);
  --on-minor-container: oklch(0.36 0.015 85);
  --conforming-container: oklch(0.94 0.03 175);
  --on-conforming-container: oklch(0.36 0.06 175);
}
* { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--surface);
  color: var(--on-surface);
  font-family: "Geist", sans-serif;
  font-size: 15px;
  line-height: 1.6;
}
h1, h2, h3 { font-family: "Space Grotesk", "Geist", sans-serif; }
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
.mono, code { font-family: "Geist Mono", ui-monospace, SFMono-Regular, Menlo, monospace; }
.proof img {
  max-width: 100%;
  border-radius: 0.5rem;
  border: 1px solid var(--outline);
  display: block;
}
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

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function isSafeProof(proof: AuditReport["proof"]): proof is {
  mimeType: "image/png";
  dataBase64: string;
} {
  return (
    proof !== null &&
    typeof proof === "object" &&
    proof.mimeType === "image/png" &&
    typeof proof.dataBase64 === "string" &&
    proof.dataBase64.length >= 8 &&
    BASE64_PATTERN.test(proof.dataBase64)
  );
}

function renderProof(report: AuditReport): string {
  const proof = report.proof;
  // The web tier has no runtime schema gate, so only a structurally-valid
  // proof (schema PINNED mimeType const + base64) may enter the src attribute.
  // Anything else — tampered mimeType, non-base64 or short data — omits the
  // section; a malformed proof can never corrupt the deliverable.
  if (!isSafeProof(proof)) {
    return "";
  }
  const altText = `Broken experience on ${hostnameOf(report.url)}`;
  return `      <section class="card proof">
        <h2>Broken experience</h2>
        <img src="data:${proof.mimeType};base64,${proof.dataBase64}" alt="${escapeHtml(altText)}" />
      </section>`;
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
    priorityBody = `<p class="note">Impact analysis unavailable. Check the Developer view for the full report.</p>`;
  } else {
    priorityBody = `<ol class="priority">\n${renderImpacts(report)}\n</ol>`;
  }

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Darkhouse Diagnostic Report</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=Geist:wght@400;500;600&family=Geist+Mono:wght@400&display=swap"
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
${renderProof(report)}
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