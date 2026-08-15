import { describe, expect, it } from "vitest";
import { validateScanUrl } from "@/lib/validate-scan-url";

describe("validateScanUrl", () => {
  it("accepts a valid public https URL", () => {
    expect(validateScanUrl("https://example.com")).toBeNull();
  });

  it("accepts https URLs with paths, ports, and query strings", () => {
    expect(validateScanUrl("  https://example.com/en-us/pricing?ref=hero  ")).toBeNull();
    expect(validateScanUrl("https://example.com:8443/")).toBeNull();
  });

  it("accepts a loopback https URL (dev carve-out)", () => {
    expect(validateScanUrl("https://127.0.0.1:8443")).toBeNull();
  });

  it("rejects an empty string", () => {
    expect(validateScanUrl("")).not.toBeNull();
  });

  it("rejects blank/whitespace-only input", () => {
    expect(validateScanUrl("   ")).not.toBeNull();
  });

  it("rejects http (non-https) URLs", () => {
    const error = validateScanUrl("http://example.com");
    expect(error).toMatch(/https:\/\//i);
  });

  it("rejects URLs missing a scheme", () => {
    const error = validateScanUrl("example.com");
    expect(error).not.toBeNull();
  });

  it("rejects URLs with no host", () => {
    expect(validateScanUrl("https://")).not.toBeNull();
  });

  it("rejects invalid hostname characters", () => {
    expect(validateScanUrl("https://exa mple.com")).not.toBeNull();
  });

  it("rejects out-of-range ports", () => {
    expect(validateScanUrl("https://example.com:0")).not.toBeNull();
  });

  it("returns a valid-https message for https URLs with a malformed port", () => {
    const error = validateScanUrl("https://example.com:notaport");
    expect(error).toBe("The URL is not a valid https address.");
  });

  it("rejects hosts with a leading or trailing hyphen in a label", () => {
    expect(validateScanUrl("https://-example.com")).not.toBeNull();
    expect(validateScanUrl("https://example.com-")).not.toBeNull();
  });

  it("rejects hosts with empty dot-separated labels", () => {
    expect(validateScanUrl("https://..")).not.toBeNull();
    expect(validateScanUrl("https://example..com")).not.toBeNull();
  });

  it("accepts valid multi-label hosts", () => {
    expect(validateScanUrl("https://sub.example.co.uk")).toBeNull();
    expect(validateScanUrl("https://localhost")).toBeNull();
  });
});