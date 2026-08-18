"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { ArchitectPatch } from "@/lib/translate/architect";

const COPY_RESET_MS = 1500;

export type DiffLineKind = "add" | "del" | "context";

export type DiffLine = { kind: DiffLineKind; text: string };

export function classifyLines(diff: string): DiffLine[] {
  if (diff.trim() === "") return [];
  const lines = diff.split(/\r?\n/);
  if (lines.length > 1 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines.map((raw) => {
    if (
      raw.startsWith("@@") ||
      raw.startsWith("--- ") ||
      raw.startsWith("+++ ") ||
      raw === ""
    ) {
      return { kind: "context", text: raw };
    }
    if (raw.startsWith("-")) {
      return { kind: "del", text: raw.slice(1) };
    }
    if (raw.startsWith("+")) {
      return { kind: "add", text: raw.slice(1) };
    }
    return { kind: "context", text: raw.startsWith(" ") ? raw.slice(1) : raw };
  });
}

const GUTTER: Record<DiffLineKind, string> = {
  add: "+",
  del: "-",
  context: "·",
};

const GUTTER_COLOR: Record<DiffLineKind, string> = {
  add: "text-code-add",
  del: "text-code-del",
  context: "text-code-muted",
};

export function DiffViewer({ patch }: { patch: ArchitectPatch }) {
  const lines = classifyLines(patch.diff);
  const [copied, setCopied] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headingId = useId();

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  function handleCopy() {
    try {
      const clipboard = navigator.clipboard;
      if (!clipboard || typeof clipboard.writeText !== "function") return;
      clipboard.writeText(patch.diff).then(
        () => {
          setCopied(true);
          if (resetTimer.current !== null) {
            clearTimeout(resetTimer.current);
          }
          resetTimer.current = setTimeout(() => {
            setCopied(false);
          }, COPY_RESET_MS);
        },
        () => {
          // The clipboard rejected the write: stay quiet, the button stays usable.
        },
      );
    } catch {
      // A synchronous clipboard failure stays quiet, the button stays usable.
    }
  }

  return (
    <section
      data-surface="dark"
      aria-labelledby={headingId}
      className="w-full rounded-lg border border-code-border bg-code-bg font-mono text-sm text-code-fg"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-code-border px-4 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-code-fg">
          Proposed changes
        </h3>
        <span className="rounded-full border border-code-warn-border bg-code-warn-bg px-2.5 py-0.5 text-xs font-medium text-code-warn-fg">
          Proposed, not applied.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {copied && (
            <span role="status" aria-live="polite" className="text-xs text-code-add">
              Copied
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="h-11 rounded-sm border border-code-border px-4 text-sm font-medium text-code-fg hover:bg-code-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-code-add"
          >
            Copy diff
          </button>
        </div>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-code-muted">No diff to render.</p>
      ) : (
        <div>
          {lines.map((line, index) => {
            const color = GUTTER_COLOR[line.kind];
            return (
              <div
                key={index}
                data-line-type={line.kind}
                className="grid grid-cols-[2ch_4ch_1fr] items-start gap-x-2 px-4 py-0.5"
              >
                <span className={color}>{GUTTER[line.kind]}</span>
                <span aria-hidden="true" className="select-none text-right text-code-muted">
                  {index + 1}
                </span>
                <span className={`whitespace-pre-wrap min-w-0 ${color}`}>{line.text}</span>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}