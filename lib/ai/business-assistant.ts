import { generateGeminiWithFallback } from "@/lib/ai/gemini-client";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

const SYSTEM_PROMPT =
  "Sei l'assistente finanziario e gestionale di un Content Creator. Rispondi alle domande basandoti SOLO sui dati forniti, in italiano. Sii preciso, professionale e sintetico. " +
  "Distingui sempre tra compensi pattuiti (agreed_fee) e incassi reali (pagamenti registrati): 'quanto ho guadagnato' si riferisce agli incassi, salvo diversa indicazione. " +
  "Le entrate YouTube sono stime mensili. Le spese vanno sottratte per calcolare il netto. Se un dato non è presente dillo chiaramente invece di stimarlo.";

type BrandJoin = { name: string } | { name: string }[] | null;

function joinName(b: BrandJoin): string {
  const n = Array.isArray(b) ? b[0]?.name : b?.name;
  return n?.trim() || "Brand";
}

function num(v: number | string | null | undefined) {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

async function buildContextSummary() {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const today = new Date().toISOString().slice(0, 10);
  const [brandsRes, collabRes, delivRes, finRes, payRes, receiptsRes] = await Promise.all([
    supabase.from("brands").select("id, name, sector").eq("user_id", userId).order("name", { ascending: true }),
    supabase
      .from("collaborations")
      .select("id, status, agreed_fee, brief_text, created_at, paid_at, is_giveaway, giveaway_value, brands ( name )")
      .eq("user_id", userId),
    supabase
      .from("deliverables")
      .select("type, status, publish_date, collaboration_id")
      .eq("user_id", userId),
    supabase.from("financials").select("type, amount, date").eq("user_id", userId),
    supabase.from("collaboration_payments").select("collaboration_id, amount, paid_at").eq("user_id", userId),
    supabase
      .from("receipts")
      .select("year, status, gross_amount, net_amount")
      .eq("user_id", userId),
  ]);

  const brands = (brandsRes.data ?? []) as { id: string; name: string; sector: string | null }[];
  const collabs = (collabRes.data ?? []) as {
    id: string;
    status: string;
    agreed_fee: number | string | null;
    brief_text: string | null;
    created_at: string;
    paid_at: string | null;
    is_giveaway: boolean | null;
    giveaway_value: number | string | null;
    brands: BrandJoin;
  }[];
  const delivs = (delivRes.data ?? []) as {
    type: string;
    status: string;
    publish_date: string | null;
    collaboration_id: string;
  }[];
  const fins = (finRes.data ?? []) as { type: string; amount: number | string | null; date: string }[];
  const pays = (payRes.data ?? []) as { collaboration_id: string; amount: number | string; paid_at: string }[];
  const receipts = (receiptsRes.data ?? []) as {
    year: number;
    status: string;
    gross_amount: number | string;
    net_amount: number | string;
  }[];

  const paidByCollab = new Map<string, number>();
  for (const p of pays) {
    paidByCollab.set(p.collaboration_id, (paidByCollab.get(p.collaboration_id) ?? 0) + num(p.amount));
  }
  const collabTitle = new Map(collabs.map((c) => [c.id, `${c.brief_text?.trim() || "Senza titolo"} (${joinName(c.brands)})`]));

  // Per mese: incassi collaborazioni, YouTube, altre entrate, spese
  const monthly = new Map<string, { collaborazioni: number; youtube: number; altreEntrate: number; spese: number }>();
  const bucket = (month: string) => {
    let m = monthly.get(month);
    if (!m) {
      m = { collaborazioni: 0, youtube: 0, altreEntrate: 0, spese: 0 };
      monthly.set(month, m);
    }
    return m;
  };
  for (const p of pays) bucket(p.paid_at.slice(0, 7)).collaborazioni += num(p.amount);
  for (const f of fins) {
    const m = bucket(String(f.date).slice(0, 7));
    const amount = Math.abs(num(f.amount));
    if (f.type === "Entrata YouTube") m.youtube += amount;
    else if (f.type === "Spesa Materiale" || f.type === "Altra spesa") m.spese += amount;
    else m.altreEntrate += amount;
  }

  const byBrand = new Map<string, { pattuito: number; incassato: number; collaborazioni: number }>();
  for (const c of collabs) {
    const b = joinName(c.brands);
    const cur = byBrand.get(b) ?? { pattuito: 0, incassato: 0, collaborazioni: 0 };
    cur.collaborazioni += 1;
    cur.pattuito += num(c.agreed_fee);
    cur.incassato += paidByCollab.get(c.id) ?? 0;
    byBrand.set(b, cur);
  }

  const receiptsByYear: Record<string, { emesse: number; lordoEmesso: number; nettoIncassato: number; inAttesa: number }> = {};
  for (const r of receipts) {
    if (r.status === "annullata") continue;
    const y = String(r.year);
    const cur = (receiptsByYear[y] ??= { emesse: 0, lordoEmesso: 0, nettoIncassato: 0, inAttesa: 0 });
    cur.emesse += 1;
    cur.lordoEmesso += num(r.gross_amount);
    if (r.status === "pagata") cur.nettoIncassato += num(r.net_amount);
    else cur.inAttesa += num(r.net_amount);
  }

  return {
    oggi: today,
    brand: { totale: brands.length, elenco: brands.map((b) => ({ nome: b.name, settore: b.sector })) },
    collaborazioni: collabs.map((c) => {
      const agreed = num(c.agreed_fee);
      const paid = paidByCollab.get(c.id) ?? 0;
      return {
        titolo: c.brief_text?.trim() || "Senza titolo",
        brand: joinName(c.brands),
        stato: c.status,
        creata: c.created_at.slice(0, 10),
        compensoPattuito: agreed || null,
        incassato: round2(paid),
        residuo: agreed > 0 ? round2(Math.max(0, agreed - paid)) : null,
        saldata: Boolean(c.paid_at),
        giveaway: c.is_giveaway ? { valoreStimato: num(c.giveaway_value) || null } : null,
      };
    }),
    perBrand: [...byBrand.entries()]
      .map(([brand, v]) => ({ brand, ...v, pattuito: round2(v.pattuito), incassato: round2(v.incassato) }))
      .sort((a, b) => b.incassato - a.incassato),
    perMese: [...monthly.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-24)
      .map(([mese, v]) => ({
        mese,
        collaborazioni: round2(v.collaborazioni),
        youtube: round2(v.youtube),
        altreEntrate: round2(v.altreEntrate),
        spese: round2(v.spese),
        netto: round2(v.collaborazioni + v.youtube + v.altreEntrate - v.spese),
      })),
    contenuti: {
      totale: delivs.length,
      nonPubblicati: delivs.filter((d) => d.status !== "pubblicato").length,
      prossimeScadenze: delivs
        .filter((d) => d.status !== "pubblicato" && d.publish_date && d.publish_date >= today)
        .sort((a, b) => String(a.publish_date).localeCompare(String(b.publish_date)))
        .slice(0, 20)
        .map((d) => ({
          data: d.publish_date,
          tipo: d.type,
          stato: d.status,
          collaborazione: collabTitle.get(d.collaboration_id) ?? null,
        })),
      inRitardo: delivs.filter((d) => d.status !== "pubblicato" && d.publish_date && d.publish_date < today).length,
    },
    ricevutePerAnno: receiptsByYear,
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
