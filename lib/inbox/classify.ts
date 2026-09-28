import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { aiModels, chatJson } from "@/lib/ai/openrouter";
import {
  INBOX_CATEGORIES,
  INBOX_CATEGORY_META,
  isInboxCategory,
  type InboxCategory,
  type InboxQuality,
} from "@/lib/inbox/constants";
import { stripQuotedReply } from "@/lib/inbox/text";

/** Dati estratti dall'AI e salvati in `email_threads.ai_insights`. */
export type ThreadInsights = {
  category: InboxCategory;
  summary: string;
  brand_match_id: string | null;
  brand_name: string | null;
  collaboration_match_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_role: string | null;
  proposed_fee: number | null;
  deliverables: { type: string; quantity: number; publish_date: string | null; notes: string | null }[];
  deadline: string | null;
  is_giveaway: boolean;
  giveaway_details: string | null;
  giveaway_value: number | null;
  is_agency: boolean;
  agency_name: string | null;
  quality: InboxQuality;
  is_urgent: boolean;
  language: string;
  next_action: string | null;
};

const nullable = (type: string) => ({ type: [type, "null"] });

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "category",
    "summary",
    "brand_match_id",
    "brand_name",
    "collaboration_match_id",
    "contact_name",
    "contact_email",
    "contact_role",
    "proposed_fee",
    "deliverables",
    "deadline",
    "is_giveaway",
    "giveaway_details",
    "giveaway_value",
    "is_agency",
    "agency_name",
    "quality",
    "is_urgent",
    "language",
    "next_action",
  ],
  properties: {
    category: { type: "string", enum: [...INBOX_CATEGORIES] },
    summary: { type: "string", description: "1-2 frasi in italiano: chi scrive, cosa chiede, cifre e date chiave" },
    brand_match_id: { ...nullable("string"), description: "id del brand dall'elenco fornito, se corrisponde" },
    brand_name: { ...nullable("string"), description: "nome del brand/azienda cliente (non l'agenzia)" },
    collaboration_match_id: { ...nullable("string"), description: "id della collaborazione aperta a cui si riferisce, se evidente" },
    contact_name: nullable("string"),
    contact_email: nullable("string"),
    contact_role: nullable("string"),
    proposed_fee: { ...nullable("number"), description: "compenso in euro proposto o concordato" },
    deliverables: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "quantity", "publish_date", "notes"],
        properties: {
          type: { type: "string", enum: ["Video YouTube", "Reel IG", "Story", "Altro"] },
          quantity: { type: "integer" },
          publish_date: { ...nullable("string"), description: "YYYY-MM-DD" },
          notes: nullable("string"),
        },
      },
    },
    deadline: { ...nullable("string"), description: "scadenza più vicina (risposta, consegna o uscita) YYYY-MM-DD" },
    is_giveaway: { type: "boolean" },
    giveaway_details: nullable("string"),
    giveaway_value: nullable("number"),
    is_agency: { type: "boolean", description: "scrive un'agenzia/piattaforma per conto del brand" },
    agency_name: nullable("string"),
    quality: { type: "string", enum: ["alta", "media", "bassa"] },
    is_urgent: { type: "boolean" },
    language: { type: "string", description: "codice lingua, es. it, en" },
    next_action: { ...nullable("string"), description: "prossima azione consigliata, max 12 parole" },
  },
} as const;

function systemPrompt(today: string) {
  const categories = INBOX_CATEGORIES.map(
    (c) => `- ${c}: ${INBOX_CATEGORY_META[c].label} — ${INBOX_CATEGORY_META[c].hint}`
  ).join("\n");
  return [
    "Sei l'assistente di una content creator italiana (YouTube, Instagram). Analizzi le conversazioni email",
    "arrivate all'indirizzo per le collaborazioni e restituisci SOLO il JSON richiesto.",
    `Oggi è ${today}.`,
    "",
    "Categorie (scegline una, in base allo stato attuale della conversazione):",
    categories,
    "",
    "Regole:",
    "- brand_match_id: usa SOLO un id presente nell'elenco brand, altrimenti null. Se scrive un'agenzia, il brand è il cliente finale.",
    "- collaboration_match_id: SOLO un id dall'elenco collaborazioni aperte, e solo se la conversazione riguarda chiaramente quel deal.",
    "- quality bassa: email massive/template generiche, piattaforme che cercano creator in blocco, niente dettagli concreti.",
    "  quality alta: brand riconoscibile, proposta specifica e personalizzata, budget o dettagli chiari.",
    "- is_urgent: scadenza entro 7 giorni o richiesta esplicita di risposta rapida.",
    "- Importi in euro come numeri (1.500 € → 1500). Date in formato YYYY-MM-DD; se manca l'anno usa il prossimo futuro.",
    "- summary e next_action in italiano, concreti, senza formule di cortesia.",
  ].join("\n");
}

type ThreadRow = {
  id: string;
  subject: string;
  status: string;
  category_source: string | null;
  brand_id: string | null;
  brand_source: string | null;
  message_count: number;
};

type MessageRow = {
  direction: string;
  from_name: string | null;
  from_email: string | null;
  received_at: string;
  body_text: string;
  attachments: { filename: string }[] | null;
};

const MAX_MESSAGES = 8;
const MAX_CHARS_PER_MESSAGE = 3500;

function renderConversation(subject: string, messages: MessageRow[]) {
  const recent = messages.slice(-MAX_MESSAGES);
  const parts = recent.map((m) => {
    const who = m.direction === "out" ? "CREATOR (risposta inviata)" : `${m.from_name ?? ""} <${m.from_email ?? "?"}>`;
    const files = (m.attachments ?? []).map((a) => a.filename).join(", ");
    const body = stripQuotedReply(m.body_text).slice(0, MAX_CHARS_PER_MESSAGE);
    return `--- ${m.received_at.slice(0, 10)} · ${who}${files ? ` · allegati: ${files}` : ""}\n${body}`;
  });
  const skipped = messages.length - recent.length;
  return `Oggetto: ${subject}\n${skipped > 0 ? `(${skipped} messaggi precedenti omessi)\n` : ""}\n${parts.join("\n\n")}`;
}

async function analyzeThread(
  supabase: SupabaseClient,
  userId: string,
  thread: ThreadRow,
  context: { brands: string; collaborations: string; brandIds: Set<string>; collabIds: Set<string> }
) {
  const { data: messages, error } = await supabase
    .from("email_messages")
    .select("direction, from_name, from_email, received_at, body_text, attachments")
    .eq("user_id", userId)
    .eq("thread_id", thread.id)
    .order("received_at", { ascending: true });
  if (error) throw new Error(error.message);

  const today = new Date().toISOString().slice(0, 10);
  const { data, model } = await chatJson<ThreadInsights>({
    model: aiModels().fast,
    maxTokens: 1200,
    jsonSchema: { name: "thread_insights", schema: SCHEMA as unknown as Record<string, unknown> },
    messages: [
      { role: "system", content: systemPrompt(today) },
      {
        role: "user",
        content: [
          `Brand in anagrafica (id | nome | domini):\n${context.brands || "(nessuno)"}`,
          `Collaborazioni aperte (id | titolo | brand):\n${context.collaborations || "(nessuna)"}`,
          `Conversazione:\n${renderConversation(thread.subject, (messages ?? []) as MessageRow[])}`,
        ].join("\n\n"),
      },
    ],
  });

  const insights: ThreadInsights = {
    ...data,
    category: isInboxCategory(data.category) ? data.category : "proposta",
    brand_match_id: data.brand_match_id && context.brandIds.has(data.brand_match_id) ? data.brand_match_id : null,
    collaboration_match_id:
      data.collaboration_match_id && context.collabIds.has(data.collaboration_match_id)
        ? data.collaboration_match_id
        : null,
    deliverables: Array.isArray(data.deliverables) ? data.deliverables : [],
  };

  const patch: Record<string, unknown> = {
    ai_status: "done",
    ai_error: null,
    ai_model: model,
    ai_analyzed_at: new Date().toISOString(),
    ai_message_count: thread.message_count,
    ai_summary: insights.summary?.slice(0, 600) ?? null,
    ai_insights: insights,
    is_agency: insights.is_agency === true,
    quality: ["alta", "media", "bassa"].includes(insights.quality) ? insights.quality : null,
    is_urgent: insights.is_urgent === true,
  };
  if (thread.category_source !== "manuale") {
    patch.category = insights.category;
    patch.category_source = "ai";
    if (insights.category === "non_pertinente" && thread.status === "nuova") patch.status = "archiviata";
  }
  if (!thread.brand_id && insights.brand_match_id) {
    patch.brand_id = insights.brand_match_id;
    patch.brand_source = "ai";
  }
  const { error: upErr } = await supabase.from("email_threads").update(patch).eq("id", thread.id).eq("user_id", userId);
  if (upErr) throw new Error(upErr.message);
}

async function loadContext(supabase: SupabaseClient, userId: string) {
  const [brandsRes, collabsRes] = await Promise.all([
    supabase.from("brands").select("id, name, email_domains").eq("user_id", userId).order("name"),
    supabase
      .from("collaborations")
      .select("id, brief_text, brands ( name )")
      .eq("user_id", userId)
      .not("status", "in", "(completata,rifiutata)")
      .order("created_at", { ascending: false })
      .limit(80),
  ]);
  const brands = (brandsRes.data ?? []) as { id: string; name: string; email_domains: string[] | null }[];
  const collabs = (collabsRes.data ?? []) as unknown as {
    id: string;
    brief_text: string | null;
    brands: { name: string } | { name: string }[] | null;
  }[];
  return {
    brands: brands.map((b) => `${b.id} | ${b.name} | ${(b.email_domains ?? []).join(", ")}`).join("\n"),
    collaborations: collabs
      .map((c) => {
        const brand = Array.isArray(c.brands) ? c.brands[0]?.name : c.brands?.name;
        return `${c.id} | ${(c.brief_text ?? "Senza titolo").slice(0, 80)} | ${brand ?? ""}`;
      })
      .join("\n"),
    brandIds: new Set(brands.map((b) => b.id)),
    collabIds: new Set(collabs.map((c) => c.id)),
  };
}

export type ClassifyResult = { analyzed: number; failed: number; remaining: boolean; skipped?: string };

/** Analizza i thread in coda (nuovi o con nuovi messaggi), i più recenti per primi. */
export async function classifyPendingThreads(opts: {
  supabase: SupabaseClient;
  userId: string;
  deadline: number;
  /** Solo questi thread (es. "Rianalizza"). */
  threadIds?: string[];
  limit?: number;
  concurrency?: number;
}): Promise<ClassifyResult> {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    return { analyzed: 0, failed: 0, remaining: false, skipped: "OPENROUTER_API_KEY non configurata" };
  }
  const { supabase, userId } = opts;
  const limit = opts.limit ?? 40;
  const select = "id, subject, status, category_source, brand_id, brand_source, message_count";
  let rows: ThreadRow[] = [];
  if (opts.threadIds?.length) {
    const { data, error } = await supabase.from("email_threads").select(select).eq("user_id", userId).in("id", opts.threadIds);
    if (error) throw new Error(error.message);
    rows = (data ?? []) as ThreadRow[];
  } else {
    // Prima le conversazioni ancora aperte (quelle che servono oggi), poi lo storico.
    for (const active of [true, false]) {
      if (rows.length > limit) break;
      let q = supabase
        .from("email_threads")
        .select(select)
        .eq("user_id", userId)
        .eq("ai_status", "pending")
        .gt("message_count", 0)
        .order("last_message_at", { ascending: false })
        .limit(limit + 1 - rows.length);
      q = active
        ? q.in("status", ["nuova", "da_rispondere", "in_attesa"])
        : q.in("status", ["gestita", "archiviata"]);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows.push(...((data ?? []) as ThreadRow[]));
    }
  }
  const queue = rows.slice(0, limit);
  let remaining = rows.length > queue.length;
  if (!queue.length) return { analyzed: 0, failed: 0, remaining: false };

  const context = await loadContext(supabase, userId);
  let analyzed = 0;
  let failed = 0;
  const done: string[] = [];

  const worker = async () => {
    while (queue.length) {
      if (Date.now() > opts.deadline) {
        remaining = true;
        return;
      }
      const thread = queue.shift()!;
      try {
        await analyzeThread(supabase, userId, thread, context);
        analyzed += 1;
        done.push(thread.id);
      } catch (err) {
        failed += 1;
        await supabase
          .from("email_threads")
          .update({ ai_status: "error", ai_error: (err instanceof Error ? err.message : String(err)).slice(0, 500) })
          .eq("id", thread.id)
          .eq("user_id", userId);
      }
    }
  };
  await Promise.all(Array.from({ length: opts.concurrency ?? 4 }, worker));
  if (done.length) await supabase.rpc("refresh_email_threads", { p_thread_ids: done });
  return { analyzed, failed, remaining: remaining || queue.length > 0 };
}
