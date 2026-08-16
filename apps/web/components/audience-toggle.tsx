"use client";

import { useEffect } from "react";

export type Audience = "client" | "developer";

export const AUDIENCE_STORAGE_KEY = "a11yfix:audience";

const OPTIONS: { value: Audience; label: string }[] = [
  { value: "client", label: "Client" },
  { value: "developer", label: "Developer" },
];

function isAudience(value: string | null): value is Audience {
  return value === "client" || value === "developer";
}

export function AudienceToggle({
  value,
  onChange,
}: {
  value: Audience;
  onChange: (audience: Audience) => void;
}) {
  useEffect(() => {
    const stored = sessionStorage.getItem(AUDIENCE_STORAGE_KEY);
    if (isAudience(stored)) {
      onChange(stored);
    }
  }, [onChange]);

  function handleSelect(audience: Audience) {
    sessionStorage.setItem(AUDIENCE_STORAGE_KEY, audience);
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