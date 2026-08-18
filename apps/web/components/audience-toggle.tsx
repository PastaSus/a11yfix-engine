"use client";

import { useEffect } from "react";

export type Audience = "client" | "developer";

export const AUDIENCE_STORAGE_KEY = "darkhouse:audience";

const OPTIONS: { value: Audience; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "developer", label: "Developer" },
];

function isAudience(value: string | null): value is Audience {
  return value === "client" || value === "developer";
}

function readStoredAudience(): Audience | null {
  try {
    const stored = sessionStorage.getItem(AUDIENCE_STORAGE_KEY);
    return isAudience(stored) ? stored : null;
  } catch {
    // Storage blocked/partitioned (private browsing, sandboxed frames): fall
    // through to the in-memory default instead of crashing the surface.
    return null;
  }
}

export function persistAudience(audience: Audience): void {
  try {
    sessionStorage.setItem(AUDIENCE_STORAGE_KEY, audience);
  } catch {
    // Persistence unavailable — stickiness degrades to in-memory state.
  }
}

export function AudienceToggle({
  value,
  onChange,
}: {
  value: Audience;
  onChange: (audience: Audience) => void;
}) {
  useEffect(() => {
    const stored = readStoredAudience();
    if (stored) {
      onChange(stored);
    }
  }, [onChange]);

  function handleSelect(audience: Audience) {
    persistAudience(audience);
    onChange(audience);
  }

  return (
    <div
      role="group"
      aria-label="Audience"
      className="flex flex-wrap items-center gap-1 rounded-full border border-outline bg-surface-container-high p-1"
    >
      {OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => handleSelect(option.value)}
            className={`h-11 rounded-full px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
              active
                ? "bg-primary text-on-primary"
                : "text-on-surface hover:bg-surface-container"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}