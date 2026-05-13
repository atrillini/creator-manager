import { analyzeBrief as analyzeGemini } from "@/lib/gemini";

export type BriefAnalysis = {
  brand_name: string;
  agreed_fee: number | null;
  is_giveaway: boolean;
  giveaway_details: string | null;
  giveaway_value: number | null;
  deliverables: { type: string; publish_date: string | null }[];
};

async function analyzeBriefOpenAI(text: string): Promise<BriefAnalysis> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error("OPENAI_API_KEY non configurata");
  }
  const prompt =
    "Sei un assistente per Content Creator. Analizza il testo di questo brief/email e restituisci SOLO un oggetto JSON con questi campi: " +
    "brand_name (stringa); " +
    "agreed_fee (numero, estrai il compenso in denaro se presente, altrimenti null); " +
    "is_giveaway (boolean, true se il brand parla di invio prodotti / barter / seeding / PR package / regalo / gift / scambio merce, anche in aggiunta al compenso); " +
    "giveaway_details (stringa breve che descrive cosa viene inviato — es. \"PS5 Pro + 2 controller\", null se non è giveaway); " +
    "giveaway_value (numero, valore € stimato dei beni inviati se citato, altrimenti null); " +
    "deliverables (array di oggetti con type e publish_date stimata, se presente).";
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: text },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`OpenAI error ${res.status}: ${body}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = json.choices?.[0]?.message?.content ?? "{}";
  const parsed = JSON.parse(content) as Partial<BriefAnalysis>;
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
          const x = d as { type?: string; publish_date?: string | null };
          return {
            type: String(x.type ?? "").trim(),
            publish_date: x.publish_date ? String(x.publish_date) : null,
          };
        })
      : [],
  };
}

export async function analyzeBrief(text: string): Promise<BriefAnalysis> {
  const provider = (process.env.AI_PROVIDER ?? "gemini").toLowerCase();
  if (provider === "openai") {
    return analyzeBriefOpenAI(text);
  }
  if (provider === "gemini") {
    return analyzeGemini(text);
  }
  // fallback: prova prima gemini poi openai
  try {
    return await analyzeGemini(text);
  } catch {
    return analyzeBriefOpenAI(text);
  }
}
