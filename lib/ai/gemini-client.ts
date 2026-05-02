import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL_CANDIDATES = [
  "gemini-2.0-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-pro-latest",
] as const;

type ModelsApiResponse = {
  models?: {
    name?: string;
    supportedGenerationMethods?: string[];
  }[];
};

export function createGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY non configurata");
  }
  return new GoogleGenerativeAI(apiKey);
}

function getApiKey() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY non configurata");
  return key;
}

function normalizeModelName(name: string) {
  return name.replace(/^models\//, "").trim();
}

export async function listAvailableGeminiModels(): Promise<string[]> {
  const apiKey = getApiKey();
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
    { cache: "no-store" }
  );
  if (!res.ok) {
    throw new Error(`ListModels fallita (${res.status})`);
  }
  const body = (await res.json()) as ModelsApiResponse;
  return (body.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => normalizeModelName(String(m.name ?? "")))
    .filter(Boolean);
}

export async function getGeminiModelCandidates() {
  const preferred = process.env.GEMINI_MODEL?.trim();
  let discovered: string[] = [];
  try {
    discovered = await listAvailableGeminiModels();
  } catch {
    discovered = [];
  }
  const base = discovered.length > 0 ? discovered : [...DEFAULT_MODEL_CANDIDATES];
  return preferred
    ? [preferred, ...base.filter((m) => m !== preferred)]
    : base;
}

export async function generateGeminiWithFallback(inputParts: { text: string }[]) {
  const genAI = createGeminiClient();
  const candidates = await getGeminiModelCandidates();

  let lastErr: unknown = null;
  for (const modelName of candidates) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(inputParts);
      return { text: result.response.text(), modelUsed: modelName };
    } catch (err) {
      lastErr = err;
    }
  }
  const message = lastErr instanceof Error ? lastErr.message : String(lastErr);
  throw new Error(`Gemini generateContent fallita su tutti i modelli candidati. Ultimo errore: ${message}`);
}
