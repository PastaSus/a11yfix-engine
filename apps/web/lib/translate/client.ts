import type { Proof, ScanResult, Violation } from "@/lib/scan";

export type { Proof };

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
  proof?: Proof | null;
};

export type TranslateDeps = {
  fetch?: typeof globalThis.fetch;
  now?: () => number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
};

export type RetryConfig = {
  maxRetries: number;
  retryBaseDelayMs: number;
  sleep: (ms: number) => Promise<void>;
};

export const DEFAULT_MAX_RETRIES = 2;
export const DEFAULT_RETRY_BASE_DELAY_MS = 1_000;

// A rate-limit wait is capped so a stubborn provider never holds a scan hostage:
// past this, the translate fails typed and the report surface offers manual retry.
const MAX_RETRY_AFTER_MS = 30_000;

function readEnvRetryNumber(env: NodeJS.ProcessEnv, key: string): number | null {
  const raw = env[key];
  if (typeof raw !== "string" || raw.trim() === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function resolveRetryConfig(
  deps: Pick<TranslateDeps, "maxRetries" | "retryBaseDelayMs" | "sleep"> = {},
  env: NodeJS.ProcessEnv = process.env,
): RetryConfig {
  return {
    maxRetries: deps.maxRetries ?? readEnvRetryNumber(env, "A11Y_AI_MAX_RETRIES") ?? DEFAULT_MAX_RETRIES,
    retryBaseDelayMs:
      deps.retryBaseDelayMs ?? readEnvRetryNumber(env, "A11Y_AI_RETRY_BASE_MS") ?? DEFAULT_RETRY_BASE_DELAY_MS,
    sleep: deps.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms))),
  };
}

function retryAfterMs(headers: Headers | undefined): number | null {
  const raw = headers?.get("retry-after");
  if (!raw) return null;
  const seconds = Number(raw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  // The HTTP-date form is not honored; exponential backoff is used instead.
  return null;
}

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
  retry: RetryConfig = resolveRetryConfig(),
): Promise<string> {
  const body = JSON.stringify({
    model: config.model,
    messages,
    temperature: 0,
    max_tokens: maxTokens,
  });

  let attempt = 0;
  let res: globalThis.Response;

  for (;;) {
    let response: globalThis.Response;
    try {
      response = await fetchLike(`${config.provider}${CHAT_PATH}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(config.key ? { Authorization: `Bearer ${config.key}` } : {}),
        },
        body,
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

    if (response.status === 429 && attempt < retry.maxRetries) {
      const delay = retryAfterMs(response.headers) ?? retry.retryBaseDelayMs * 2 ** attempt;
      await retry.sleep(delay);
      attempt += 1;
      continue;
    }
    res = response;
    break;
  }

  if (res.status === 429) {
    throw new TranslateError("rate_limited", "The AI provider is rate-limited; a later retry may succeed.");
  }
  if (!res.ok) {
    throw new TranslateError("translate_error", `The AI provider responded with HTTP ${res.status}.`);
  }

  let bodyOut: unknown;
  try {
    bodyOut = await res.json();
  } catch {
    throw new TranslateError("translate_error", "The AI provider returned an unreadable response.");
  }

  const content = readChatContent(bodyOut);
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
