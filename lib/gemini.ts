import { generateGeminiWithFallback } from "@/lib/ai/gemini-client";

export type GeminiBriefDeliverable = {
  type: string;
  publish_date: string | null;
};

export type GeminiBriefAnalysis = {
  brand_name: string;
  agreed_fee: number | null;
  is_giveaway: boolean;
  giveaway_details: string | null;
  giveaway_value: number | null;
  deliverables: GeminiBriefDeliverable[];
};

const SYSTEM_PROMPT =
  "Sei un assistente per Content Creator. Analizza il testo di questo brief/email e restituisci SOLO un oggetto JSON con questi campi: " +
  "brand_name (stringa); " +
  "agreed_fee (numero, estrai il compenso in denaro se presente, altrimenti null); " +
  "is_giveaway (boolean, true se il brand parla di invio prodotti / barter / seeding / PR package / regalo / gift / scambio merce, anche in aggiunta al compenso); " +
  "giveaway_details (stringa breve che descrive cosa viene inviato — es. \"PS5 Pro + 2 controller\", null se non è giveaway); " +
  "giveaway_value (numero, valore € stimato dei beni inviati se citato, altrimenti null); " +
  "deliverables (array di oggetti con type e publish_date stimata, se presente).";

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
  const giveawayDetails =
    typeof parsed.giveaway_details === "string"
      ? parsed.giveaway_details.trim()
      : "";
  return {
    brand_name: String(parsed.brand_name ?? "").trim(),
    agreed_fee:
      parsed.agreed_fee == null || Number.isNaN(Number(parsed.agreed_fee))
        ? null
        : Number(parsed.agreed_fee),
    is_giveaway: parsed.is_giveaway === true,
    giveaway_details: giveawayDetails ? giveawayDetails : null,
    giveaway_value:
      parsed.giveaway_value == null ||
      Number.isNaN(Number(parsed.giveaway_value))
        ? null
        : Number(parsed.giveaway_value),
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
