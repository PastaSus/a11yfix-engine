export type StageName = "scanning" | "translating" | "ready";

const STAGES: { key: StageName; label: string }[] = [
  { key: "scanning", label: "Scanning" },
  { key: "translating", label: "Translating" },
  { key: "ready", label: "Ready" },
];

export function ProgressStepper({ current }: { current: StageName }) {
  const currentIndex = STAGES.findIndex((stage) => stage.key === current);

  return (
    <ol className="flex flex-wrap items-center gap-y-2 text-sm" aria-label="Scan progress">
      {STAGES.map((stage, index) => {
        const isActive = index === currentIndex;
        const isComplete = index < currentIndex;
        return (
          <li
            key={stage.key}
            aria-current={isActive ? "step" : undefined}
            className="flex items-center"
          >
            {index > 0 && (
              <span
                aria-hidden="true"
                className="mx-2 h-px w-6 bg-outline transition-colors motion-reduce:transition-none"
              />
            )}
            <span
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 font-medium transition-colors motion-reduce:transition-none ${
                isComplete
                  ? "bg-success-container text-on-success-container"
                  : isActive
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex h-4 w-4 items-center justify-center rounded-full bg-surface-container-high text-[10px] font-bold"
              >
                {isComplete ? "✓" : index + 1}
              </span>
              {stage.label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}