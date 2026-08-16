import type { ScanResult, Violation } from "@/lib/scan";

// OQ-1 is open in the PRD (DeepSeek vs Gemini free vs Groq vs local Ollama). These
// free-tier defaults are an explicit placeholder until a provider is decided:
// the module resolves providers/models from env, so it works as soon as A11Y_AI_PROVIDER
// is supplied, and fails typed against the placeholder when it is not.
export const DEFAULT_AI_PROVIDER = "https://provider.example/v1";
export const DEFAULT_AI_MODEL = "free-tier-chat-model";

const CHAT_PATH = "/chat/completions";
const CHAT_TIMEOUT_MS = 30_000;

export type AnalystImpact = {
  violation_id: string;
  business_problem: string;
  affected_segment: string;
  wcag_consequence: string;
  conversion_impact_estimate: string;
};

export type ArchitectPatch = {
  status: "proposed";
  diff: string;
  rationale: string;
  wcag_rule: string;
};

export type AuditReport = {
  schemaVersion: string;
  scanId: string;
  url: string;
  violations: Violation[];
  vitals: ScanResult["vitals"];
  timestamp: string;
  analyst_impacts: AnalystImpact[];
  architect_patches: ArchitectPatch[];
};

export type TranslateDeps = {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
};

export type TranslateErrorCode = "rate_limited" | "translate_error";

export class TranslateError extends Error {
  readonly code: TranslateErrorCode;
  readonly stage: "translate";

  constructor(code: TranslateErrorCode, message: string, options: { cause?: unknown } = {}) {
    super(message);
    this.name = "TranslateError";
    this.code = code;
    this.stage = "translate";
    this.cause = options.cause;
  }
}

export type AiConfig = {
  provider: string;
  model: string;
  key: string | null;
};

export type ChatMessage = { role: "system" | "user"; content: string };

export function readAiConfig(env: NodeJS.ProcessEnv = process.env): AiConfig {
  return {
    provider: (env.A11Y_AI_PROVIDER?.trim() || DEFAULT_AI_PROVIDER).replace(/\/+$/, ""),
    model: env.A11Y_AI_MODEL?.trim() || DEFAULT_AI_MODEL,
    key: env.A11Y_AI_KEY?.trim() || null,
  };
}

export function readChatContent(body: unknown): string | null {
  const choices = (body as { choices?: unknown[] })?.choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } })?.message;
  return typeof message?.content === "string" ? message.content : null;
}

export async function chat(
  config: AiConfig,
  messages: ChatMessage[],
  maxTokens: number,
  fetchLike: typeof globalThis.fetch,
): Promise<string> {
  let res: globalThis.Response;
  try {
    res = await fetchLike(`${config.provider}${CHAT_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0,
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === "TimeoutError" ||
        (typeof DOMException !== "undefined" &&
          error.cause instanceof DOMException &&
          error.cause.name === "TimeoutError"));
    throw new TranslateError(
      "translate_error",
      timedOut ? "The AI provider request timed out." : "The AI provider could not be reached.",
      { cause: error },
    );
  }

  if (res.status === 429) {
    throw new TranslateError("rate_limited", "The AI provider is rate-limited; a later retry may succeed.");
  }
  if (!res.ok) {
    throw new TranslateError("translate_error", `The AI provider responded with HTTP ${res.status}.`);
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new TranslateError("translate_error", "The AI provider returned an unreadable response.");
  }

  const content = readChatContent(body);
  if (typeof content !== "string" || content.trim() === "") {
    throw new TranslateError("translate_error", "The AI provider returned no usable content.");
  }
  return content;
}

export function extractJsonArray(content: string): Array<Record<string, unknown>> {
  const start = content.indexOf("[");
  const end = content.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new TranslateError("translate_error", "The AI provider response contained no JSON array.");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content.slice(start, end + 1));
  } catch {
    throw new TranslateError("translate_error", "The AI provider returned malformed JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new TranslateError("translate_error", "The AI provider response was not a JSON array.");
  }
  return parsed as Array<Record<string, unknown>>;
}
