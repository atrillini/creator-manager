import { generateGeminiWithFallback } from "@/lib/ai/gemini-client";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

const SYSTEM_PROMPT =
  "Sei l'assistente finanziario e gestionale di un Content Creator. Rispondi alle domande basandoti sui dati forniti. Sii preciso, professionale e sintetico. Ad esempio, se l'utente chiede quali brand hanno pagato di più quest'anno, somma i compensi pattiuti e fai una classifica. Se chiede quanti contenuti mancano, conta i deliverables non pubblicati.";

type Summary = {
  generatedAt: string;
  brands: {
    total: number;
    list: { id: string; name: string; sector: string | null }[];
  };
  collaborations: {
    total: number;
    byStatus: Record<string, number>;
    totalAgreedFee: number;
    topBrandByAgreedFee: { brand: string; total: number }[];
  };
  deliverables: {
    total: number;
    nonPublished: number;
    byStatus: Record<string, number>;
  };
  financials: {
    totalRows: number;
    byTypeAmount: Record<string, number>;
    monthlyRevenue: { month: string; total: number }[];
  };
};

async function buildContextSummary(): Promise<Summary> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const [brandsRes, collabRes, delivRes, finRes] = await Promise.all([
    supabase.from("brands").select("id, name, sector").eq("user_id", userId).order("name", { ascending: true }),
    supabase
      .from("collaborations")
      .select("status, agreed_fee, brands ( name )")
      .eq("user_id", userId),
    supabase.from("deliverables").select("status").eq("user_id", userId),
    supabase.from("financials").select("type, amount, date").eq("user_id", userId),
  ]);

  const brands = (brandsRes.data ?? []) as { id: string; name: string; sector: string | null }[];
  const collabs = (collabRes.data ?? []) as {
    status: string;
    agreed_fee: number | string | null;
    brands: { name: string } | { name: string }[] | null;
  }[];
  const delivs = (delivRes.data ?? []) as { status: string }[];
  const fins = (finRes.data ?? []) as { type: string; amount: number | string | null; date: string }[];

  const byStatus: Record<string, number> = {};
  let totalAgreedFee = 0;
  const brandFee = new Map<string, number>();
  for (const c of collabs) {
    const s = String(c.status || "sconosciuto");
    byStatus[s] = (byStatus[s] ?? 0) + 1;
    const fee = Number(c.agreed_fee ?? 0);
    if (Number.isFinite(fee) && fee > 0) {
      totalAgreedFee += fee;
      const b = Array.isArray(c.brands) ? c.brands[0]?.name : c.brands?.name;
      const bn = b?.trim() || "Brand";
      brandFee.set(bn, (brandFee.get(bn) ?? 0) + fee);
    }
  }
  const topBrandByAgreedFee = [...brandFee.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([brand, total]) => ({ brand, total }));

  const delivByStatus: Record<string, number> = {};
  let nonPublished = 0;
  for (const d of delivs) {
    const s = String(d.status || "sconosciuto");
    delivByStatus[s] = (delivByStatus[s] ?? 0) + 1;
    if (s !== "pubblicato") nonPublished += 1;
  }

  const byTypeAmount: Record<string, number> = {};
  const byMonth = new Map<string, number>();
  for (const f of fins) {
    const type = String(f.type || "Altro");
    const amount = Number(f.amount ?? 0);
    if (!Number.isFinite(amount)) continue;
    byTypeAmount[type] = (byTypeAmount[type] ?? 0) + amount;
    const month = String(f.date).slice(0, 7);
    byMonth.set(month, (byMonth.get(month) ?? 0) + amount);
  }
  const monthlyRevenue = [...byMonth.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-12)
    .map(([month, total]) => ({ month, total }));

  return {
    generatedAt: new Date().toISOString(),
    brands: { total: brands.length, list: brands },
    collaborations: {
      total: collabs.length,
      byStatus,
      totalAgreedFee,
      topBrandByAgreedFee,
    },
    deliverables: {
      total: delivs.length,
      nonPublished,
      byStatus: delivByStatus,
    },
    financials: {
      totalRows: fins.length,
      byTypeAmount,
      monthlyRevenue,
    },
  };
}

export async function askBusinessAssistant(question: string) {
  const q = question.trim();
  if (q.length < 2) {
    throw new Error("Inserisci una domanda valida");
  }

  const context = await buildContextSummary();
  const result = await generateGeminiWithFallback([
    { text: SYSTEM_PROMPT },
    {
      text: `Contesto dati (JSON):\n${JSON.stringify(context)}`,
    },
    { text: `Domanda utente: ${q}` },
  ]);

  return {
    answer: result.text.trim(),
    context,
  };
}
