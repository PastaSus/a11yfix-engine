const HOSTNAME_LABEL_PATTERN = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/i;

export function validateScanUrl(url: string): string | null {
  const candidate = url.trim();
  if (!candidate) {
    return "A URL is required.";
  }

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) {
      if (candidate.toLowerCase().startsWith("https:")) {
        return "The URL is not a valid https address.";
      }
      return "Only https:// URLs are accepted.";
    }
    return "A URL must include a scheme (https://).";
  }

  if (parsed.protocol !== "https:") {
    return "Only https:// URLs are accepted.";
  }

  if (!parsed.hostname) {
    return "The URL is missing a host (e.g. https://example.com).";
  }

  if (parsed.port !== "") {
    const port = Number(parsed.port);
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return "The URL contains an out-of-range port.";
    }
  }

  const labels = parsed.hostname.split(".");
  if (labels.some((label) => !HOSTNAME_LABEL_PATTERN.test(label))) {
    return "The URL contains an invalid hostname.";
  }

  return null;
}