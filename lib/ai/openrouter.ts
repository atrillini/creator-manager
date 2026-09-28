import "server-only";
import { configuredAppUrl } from "@/lib/app-url";

/**
 * Client OpenRouter (API compatibile OpenAI). Due modelli configurabili:
 * - AI_MODEL_FAST: classificazione di ogni email, estrazione dati dal brief
 * - AI_MODEL_SMART: assistente business (domande libere sui dati)
 * I provider che conservano i dati per training sono esclusi (data_collection: deny).
 */

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_FAST = "anthropic/claude-haiku-4.5";
const DEFAULT_SMART = "anthropic/claude-sonnet-5";

export function aiModels() {
  return {
    fast: process.env.AI_MODEL_FAST?.trim() || DEFAULT_FAST,
    smart: process.env.AI_MODEL_SMART?.trim() || DEFAULT_SMART,
  };
}

type Message = { role: "system" | "user" | "assistant"; content: string };

type ChatOptions = {
  model: string;
  messages: Message[];
  maxTokens?: number;
  temperature?: number;
  /** JSON Schema per l'output strutturato. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  timeoutMs?: number;
};

type ChatResponse = {
  model?: string;
  choices?: { message?: { content?: string | null }; finish_reason?: string }[];
  error?: { message?: string };
};

async function chat(opts: ChatOptions): Promise<{ content: string; model: string }> {
  const key = process.env.OPENROUTER_API_KEY?.trim();
  if (!key) throw new Error("OPENROUTER_API_KEY non configurata");
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      "HTTP-Referer": configuredAppUrl() ?? "https://creatorcrm.local",
      "X-Title": "CreatorCRM",
    },
    body: JSON.stringify({
      model: opts.model,
      messages: opts.messages,
      max_tokens: opts.maxTokens ?? 1500,
      temperature: opts.temperature ?? 0,
      ...(opts.jsonSchema
        ? {
            response_format: {
              type: "json_schema",
              json_schema: { name: opts.jsonSchema.name, strict: true, schema: opts.jsonSchema.schema },
            },
          }
        : {}),
      provider: {
        data_collection: "deny",
        ...(opts.jsonSchema ? { require_parameters: true } : {}),
      },
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 60_000),
  });
  const body = (await res.json().catch(() => ({}))) as ChatResponse;
  if (!res.ok || body.error) {
    throw new Error(`OpenRouter ${res.status}: ${body.error?.message ?? "risposta non valida"}`);
  }
  const content = body.choices?.[0]?.message?.content ?? "";
  if (!content.trim()) throw new Error("OpenRouter: risposta vuota");
  return { content, model: body.model ?? opts.model };
}

function parseJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  return JSON.parse(start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned) as T;
}

export async function chatJson<T>(opts: ChatOptions & { jsonSchema: NonNullable<ChatOptions["jsonSchema"]> }) {
  const { content, model } = await chat(opts);
  return { data: parseJson<T>(content), model };
}

export async function chatText(opts: Omit<ChatOptions, "jsonSchema">) {
  return chat(opts);
}
