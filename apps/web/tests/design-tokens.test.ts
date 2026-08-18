import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf-8");

describe("design token foundation", () => {
  it("pins the frozen severity palette values in globals.css", () => {
    expect(globalsCss).toContain("--critical: oklch(0.52 0.19 27)");
    expect(globalsCss).toContain("--critical-container: oklch(0.93 0.03 27)");
    expect(globalsCss).toContain("--moderate: oklch(0.62 0.13 65)");
    expect(globalsCss).toContain("--minor: oklch(0.47 0.015 85)");
    expect(globalsCss).toContain("--conforming: oklch(0.56 0.08 175)");
  });

  it("maps the severity palette through @theme inline so utilities resolve", () => {
    expect(globalsCss).toContain("--color-critical: var(--critical)");
    expect(globalsCss).toContain("--color-minor-container: var(--minor-container)");
    expect(globalsCss).toContain("--color-conforming-container: var(--conforming-container)");
  });

  it("pins the Space Grotesk + Geist font tokens and the report reading measure", () => {
    expect(globalsCss).toContain("--font-sans: var(--font-geist)");
    expect(globalsCss).toContain("--font-mono: var(--font-geist-mono)");
    expect(globalsCss).toContain("--font-display: var(--font-space-grotesk)");
    expect(globalsCss).toContain("--container-report: 1040px");
  });

  it("pins the evergreen brand accent theme-aware", () => {
    expect(globalsCss).toContain("--primary: oklch(0.42 0.09 160)");
    expect(globalsCss).toContain("--primary: oklch(0.72 0.09 160)");
    expect(globalsCss).toContain("--color-primary: var(--primary)");
  });

  it("pins the locked radius scale and the code-surface warning tokens", () => {
    expect(globalsCss).toContain("--radius-sm: 6px");
    expect(globalsCss).toContain("--radius-md: 10px");
    expect(globalsCss).toContain("--radius-lg: 14px");
    expect(globalsCss).toContain("--code-warn-fg: oklch(0.83 0.11 70)");
    expect(globalsCss).toContain("--color-code-warn-fg: var(--code-warn-fg)");
  });

  it("keeps the palette theme-aware with color-scheme and dark overrides", () => {
    expect(globalsCss).toContain("color-scheme: light");
    expect(globalsCss).toContain("color-scheme: dark");
    expect(globalsCss).toContain("@media (prefers-color-scheme: dark)");
  });

  it("keeps the app shell on the warm paper/ink tokens", () => {
    expect(globalsCss).toContain("background: var(--background)");
    expect(globalsCss).toContain("color: var(--on-surface)");
  });
});