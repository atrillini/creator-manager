import { generateGeminiWithFallback } from "@/lib/ai/gemini-client";

export type GeminiBriefDeliverable = {
  type: string;
  publish_date: string | null;
};

export type GeminiBriefAnalysis = {
  brand_name: string;
  agreed_fee: number | null;
  deliverables: GeminiBriefDeliverable[];
};

const SYSTEM_PROMPT =
  "Sei un assistente per Content Creator. Analizza il testo di questo brief/email e restituisci SOLO un oggetto JSON con questi campi: brand_name (stringa), agreed_fee (numero, estrai il compenso se presente, altrimenti null), deliverables (array di oggetti con type e publish_date stimata, se presente)";

function parseJsonResult(raw: string): GeminiBriefAnalysis {
  const trimmed = raw.trim();
  const cleaned = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonLike = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  const parsed = JSON.parse(jsonLike) as Partial<GeminiBriefAnalysis>;
  return {
    brand_name: String(parsed.brand_name ?? "").trim(),
    agreed_fee:
      parsed.agreed_fee == null || Number.isNaN(Number(parsed.agreed_fee))
        ? null
        : Number(parsed.agreed_fee),
    deliverables: Array.isArray(parsed.deliverables)
      ? parsed.deliverables.map((d) => {
          const x = d as Partial<GeminiBriefDeliverable>;
          return {
            type: String(x.type ?? "").trim(),
            publish_date: x.publish_date ? String(x.publish_date) : null,
          };
        })
      : [],
  };
}

export async function analyzeBrief(text: string): Promise<GeminiBriefAnalysis> {
  const input = text.trim();
  if (input.length < 5) {
    throw new Error("Incolla un brief più completo");
  }
  const result = await generateGeminiWithFallback([
    { text: SYSTEM_PROMPT },
    { text: input },
  ]);
  const raw = result.text;
  const parsed = parseJsonResult(raw);
  if (!parsed.brand_name) {
    throw new Error("Gemini non ha restituito un brand_name valido");
  }
  return parsed;
}
