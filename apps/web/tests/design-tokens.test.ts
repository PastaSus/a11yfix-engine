import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const globalsCss = readFileSync(resolve(process.cwd(), "app/globals.css"), "utf-8");

describe("design token foundation", () => {
  it("pins the frozen severity palette values in globals.css", () => {
    expect(globalsCss).toContain("--critical: #b91c1c");
    expect(globalsCss).toContain("--critical-container: #fee2e2");
    expect(globalsCss).toContain("--moderate: #b45309");
    expect(globalsCss).toContain("--minor: #475569");
    expect(globalsCss).toContain("--conforming: #0f766e");
  });

  it("maps the severity palette through @theme inline so utilities resolve", () => {
    expect(globalsCss).toContain("--color-critical: var(--critical)");
    expect(globalsCss).toContain("--color-minor-container: var(--minor-container)");
    expect(globalsCss).toContain("--color-conforming-container: var(--conforming-container)");
  });

  it("pins the Inter + JetBrains Mono font tokens and the report reading measure", () => {
    expect(globalsCss).toContain("--font-sans: var(--font-inter)");
    expect(globalsCss).toContain("--font-mono: var(--font-jetbrains-mono)");
    expect(globalsCss).toContain("--container-report: 1040px");
  });

  it("keeps the palette theme-aware with color-scheme and dark overrides", () => {
    expect(globalsCss).toContain("color-scheme: light");
    expect(globalsCss).toContain("color-scheme: dark");
    expect(globalsCss).toContain("@media (prefers-color-scheme: dark)");
  });

  it("keeps the app shell on the slate surface/ink tokens", () => {
    expect(globalsCss).toContain("background: var(--surface)");
    expect(globalsCss).toContain("color: var(--on-surface)");
  });
});