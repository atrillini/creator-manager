import "server-only";
import { aiModels, chatJson } from "@/lib/ai/openrouter";

export type BriefAnalysis = {
  brand_name: string;
  agreed_fee: number | null;
  is_giveaway: boolean;
  giveaway_details: string | null;
  giveaway_value: number | null;
  deliverables: { type: string; publish_date: string | null }[];
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["brand_name", "agreed_fee", "is_giveaway", "giveaway_details", "giveaway_value", "deliverables"],
  properties: {
    brand_name: { type: "string", description: "brand cliente (non l'agenzia)" },
    agreed_fee: { type: ["number", "null"], description: "compenso in euro, se presente" },
    is_giveaway: {
      type: "boolean",
      description: "invio prodotti / barter / seeding / PR package / gift, anche in aggiunta al compenso",
    },
    giveaway_details: { type: ["string", "null"], description: "cosa viene inviato, es. \"PS5 Pro + 2 controller\"" },
    giveaway_value: { type: ["number", "null"], description: "valore € stimato dei beni, se citato" },
    deliverables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "publish_date"],
        properties: {
          type: { type: "string", enum: ["Video YouTube", "Reel IG", "Story", "Altro"] },
          publish_date: { type: ["string", "null"], description: "YYYY-MM-DD" },
        },
      },
    },
  },
};

/** Estrae i dati del deal da un brief/email incollato (dialog "Genera da brief"). */
export async function analyzeBrief(text: string): Promise<BriefAnalysis> {
  const input = text.trim();
  if (input.length < 5) throw new Error("Incolla un brief più completo");
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await chatJson<BriefAnalysis>({
    model: aiModels().fast,
    maxTokens: 800,
    jsonSchema: { name: "brief_analysis", schema: SCHEMA },
    messages: [
      {
        role: "system",
        content:
          `Sei l'assistente di una content creator. Oggi è ${today}. Estrai dal brief/email i dati della collaborazione. ` +
          "Una riga di deliverables per ogni contenuto (3 reel = 3 righe). Date in formato YYYY-MM-DD, " +
          "se manca l'anno usa il prossimo futuro. Importi in euro come numeri.",
      },
      { role: "user", content: input.slice(0, 20_000) },
    ],
  });
  if (!data.brand_name?.trim()) throw new Error("Brand non riconosciuto nel testo");
  return {
    brand_name: data.brand_name.trim(),
    agreed_fee: Number.isFinite(Number(data.agreed_fee)) && data.agreed_fee != null ? Number(data.agreed_fee) : null,
    is_giveaway: data.is_giveaway === true,
    giveaway_details: data.giveaway_details?.trim() || null,
    giveaway_value:
      Number.isFinite(Number(data.giveaway_value)) && data.giveaway_value != null ? Number(data.giveaway_value) : null,
    deliverables: Array.isArray(data.deliverables) ? data.deliverables : [],
  };
}
