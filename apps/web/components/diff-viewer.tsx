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
  add: "text-green-400",
  del: "text-red-400",
  context: "text-slate-400",
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
      className="w-full rounded-lg border border-white/10 bg-[#0f172a] font-mono text-sm text-slate-300"
    >
      <header className="flex flex-wrap items-center gap-3 border-b border-white/10 px-4 py-3">
        <h3 id={headingId} className="text-sm font-semibold text-slate-200">
          Proposed changes
        </h3>
        <span className="rounded-full border border-amber-300/40 bg-amber-400/10 px-2.5 py-0.5 text-xs font-medium text-amber-300">
          Proposed — not applied.
        </span>
        <div className="ml-auto flex items-center gap-2">
          {copied && (
            <span role="status" aria-live="polite" className="text-xs text-emerald-400">
              Copied
            </span>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="h-11 rounded-md border border-white/15 px-4 text-sm font-medium text-slate-200 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            Copy diff
          </button>
        </div>
      </header>

      {lines.length === 0 ? (
        <p className="px-4 py-6 text-slate-400">No diff to render.</p>
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
                <span aria-hidden="true" className="select-none text-right text-slate-600">
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