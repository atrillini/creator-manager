import type { ThreadInsights } from "@/lib/inbox/classify";
import {
  INBOX_CATEGORIES,
  type InboxCategory,
  type InboxQuality,
  type InboxStatus,
} from "@/lib/inbox/constants";
import { unaccent } from "@/lib/inbox/text";
import { INBOX_VIEWS, type InboxView } from "@/lib/inbox/views";

export { INBOX_VIEWS, parseInboxView, type InboxView } from "@/lib/inbox/views";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

export type InboxFilters = {
  view: InboxView;
  category?: InboxCategory;
  brandId?: string;
  tagId?: string;
  /** Solo thread senza brand. */
  unlinked?: boolean;
  q?: string;
  /** Cursore keyset: last_message_at dell'ultimo elemento della pagina precedente. */
  before?: string;
};

export type InboxTag = { id: string; name: string; color: string | null };

export type InboxThreadListItem = {
  id: string;
  subject: string;
  lastMessageAt: string | null;
  lastFrom: string;
  lastDirection: string | null;
  preview: string;
  messageCount: number;
  status: InboxStatus;
  category: InboxCategory | null;
  brand: { id: string; name: string } | null;
  collaboration: { id: string; title: string } | null;
  summary: string | null;
  quality: InboxQuality | null;
  isUrgent: boolean;
  isAgency: boolean;
  aiStatus: string;
  tags: InboxTag[];
};

const PAGE_SIZE = 40;

type ThreadRowDb = {
  id: string;
  subject: string;
  last_message_at: string | null;
  last_from_name: string | null;
  last_from_email: string | null;
  last_direction: string | null;
  last_preview: string;
  message_count: number;
  status: InboxStatus;
  category: InboxCategory | null;
  brand_id: string | null;
  collaboration_id: string | null;
  ai_summary: string | null;
  quality: InboxQuality | null;
  is_urgent: boolean;
  is_agency: boolean;
  ai_status: string;
  brands: { id: string; name: string } | { id: string; name: string }[] | null;
  collaborations: { id: string; brief_text: string | null } | { id: string; brief_text: string | null }[] | null;
  email_thread_tags: { email_tags: InboxTag | InboxTag[] | null }[] | null;
};

const THREAD_SELECT = `id, subject, last_message_at, last_from_name, last_from_email, last_direction, last_preview,
  message_count, status, category, brand_id, collaboration_id, ai_summary, quality, is_urgent, is_agency, ai_status,
  brands ( id, name ), collaborations ( id, brief_text ),
  email_thread_tags ( email_tags ( id, name, color ) )`;

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);

function mapThread(r: ThreadRowDb): InboxThreadListItem {
  const brand = one(r.brands);
  const collab = one(r.collaborations);
  return {
    id: r.id,
    subject: r.subject || "(Senza oggetto)",
    lastMessageAt: r.last_message_at,
    lastFrom:
      r.last_direction === "out" ? "Tu" : r.last_from_name || r.last_from_email || "Mittente sconosciuto",
    lastDirection: r.last_direction,
    preview: r.last_preview,
    messageCount: r.message_count,
    status: r.status,
    category: r.category,
    brand: brand ? { id: brand.id, name: brand.name } : null,
    collaboration: collab ? { id: collab.id, title: collab.brief_text?.trim() || "Senza titolo" } : null,
    summary: r.ai_summary,
    quality: r.quality,
    isUrgent: r.is_urgent,
    isAgency: r.is_agency,
    aiStatus: r.ai_status,
    tags: (r.email_thread_tags ?? [])
      .map((t) => one(t.email_tags))
      .filter((t): t is InboxTag => !!t)
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
}

/** "micro onde" → "micro:* & onde:*" (prefisso, senza accenti, nessuna sintassi tsquery dall'utente). */
function toPrefixQuery(q: string) {
  return unaccent(q.toLowerCase())
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length >= 2)
    .slice(0, 8)
    .map((w) => `${w}:*`)
    .join(" & ");
}

export async function getInboxThreads(filters: InboxFilters) {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  let threadIdsForTag: string[] | null = null;
  if (filters.tagId && isValidUuid(filters.tagId)) {
    const { data } = await supabase
      .from("email_thread_tags")
      .select("thread_id")
      .eq("user_id", userId)
      .eq("tag_id", filters.tagId);
    threadIdsForTag = (data ?? []).map((r) => String(r.thread_id));
    if (!threadIdsForTag.length) return { items: [] as InboxThreadListItem[], nextCursor: null };
  }

  let q = supabase
    .from("email_threads")
    .select(THREAD_SELECT)
    .eq("user_id", userId)
    .gt("message_count", 0)
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .limit(PAGE_SIZE + 1);

  const query = filters.q?.trim();
  // Con la ricerca si cerca in tutte le viste.
  if (!query) q = q.in("status", INBOX_VIEWS[filters.view].statuses);
  if (filters.category) q = q.eq("category", filters.category);
  if (filters.brandId && isValidUuid(filters.brandId)) q = q.eq("brand_id", filters.brandId);
  if (filters.unlinked) q = q.is("brand_id", null);
  if (threadIdsForTag) q = q.in("id", threadIdsForTag);
  if (filters.before) q = q.lt("last_message_at", filters.before);
  if (query) {
    const tsq = toPrefixQuery(query);
    if (tsq) q = q.textSearch("search", tsq, { config: "simple" });
  }

  const { data, error } = await q;
  if (error) {
    console.warn("[CreatorCRM] inbox:", error.message);
    return { items: [] as InboxThreadListItem[], nextCursor: null };
  }
  const rows = (data ?? []) as unknown as ThreadRowDb[];
  const page = rows.slice(0, PAGE_SIZE).map(mapThread);
  const nextCursor = rows.length > PAGE_SIZE ? page[page.length - 1]?.lastMessageAt ?? null : null;
  return { items: page, nextCursor };
}

export type InboxCounts = {
  views: Record<InboxView, number>;
  categories: Record<InboxCategory, number>;
  unlinked: number;
  aiPending: number;
};

/** Conteggi per la colonna filtri (categorie: solo thread non archiviati). */
export async function getInboxCounts(): Promise<InboxCounts> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data } = await supabase
    .from("email_threads")
    .select("status, category, brand_id, ai_status")
    .eq("user_id", userId)
    .gt("message_count", 0);
  const views = Object.fromEntries(Object.keys(INBOX_VIEWS).map((k) => [k, 0])) as Record<InboxView, number>;
  const categories = Object.fromEntries(INBOX_CATEGORIES.map((c) => [c, 0])) as Record<InboxCategory, number>;
  let unlinked = 0;
  let aiPending = 0;
  for (const r of (data ?? []) as {
    status: InboxStatus;
    category: InboxCategory | null;
    brand_id: string | null;
    ai_status: string;
  }[]) {
    for (const [view, def] of Object.entries(INBOX_VIEWS) as [InboxView, (typeof INBOX_VIEWS)[InboxView]][]) {
      if (def.statuses.includes(r.status)) views[view] += 1;
    }
    if (r.status !== "archiviata") {
      if (r.category) categories[r.category] += 1;
      if (!r.brand_id && r.category !== "non_pertinente") unlinked += 1;
    }
    if (r.ai_status === "pending") aiPending += 1;
  }
  return { views, categories, unlinked, aiPending };
}

export type InboxMessage = {
  id: string;
  direction: "in" | "out";
  from: string;
  fromEmail: string | null;
  to: string[];
  subject: string;
  receivedAt: string;
  bodyText: string;
  hasHtml: boolean;
  attachments: { filename: string; contentType: string; size: number }[];
  /** Arrivata nella cartella Spam/Posta indesiderata. */
  fromSpam: boolean;
};

export type InboxThreadDetail = InboxThreadListItem & {
  participants: string[];
  insights: ThreadInsights | null;
  aiError: string | null;
  aiModel: string | null;
  messages: InboxMessage[];
};

export async function getInboxThreadDetail(id: string): Promise<InboxThreadDetail | null> {
  if (!isValidUuid(id)) return null;
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const [threadRes, messagesRes] = await Promise.all([
    supabase
      .from("email_threads")
      .select(`${THREAD_SELECT}, participants, ai_insights, ai_error, ai_model`)
      .eq("user_id", userId)
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("email_messages")
      .select("id, mailbox, direction, from_name, from_email, to_emails, subject, received_at, body_text, body_html, attachments")
      .eq("user_id", userId)
      .eq("thread_id", id)
      .order("received_at", { ascending: true }),
  ]);
  if (!threadRes.data) return null;
  const row = threadRes.data as unknown as ThreadRowDb & {
    participants: string[];
    ai_insights: ThreadInsights | null;
    ai_error: string | null;
    ai_model: string | null;
  };
  return {
    ...mapThread(row),
    participants: row.participants ?? [],
    insights: row.ai_insights,
    aiError: row.ai_error,
    aiModel: row.ai_model,
    messages: ((messagesRes.data ?? []) as {
      id: string;
      mailbox: string;
      direction: "in" | "out";
      from_name: string | null;
      from_email: string | null;
      to_emails: string[] | null;
      subject: string;
      received_at: string;
      body_text: string;
      body_html: string | null;
      attachments: InboxMessage["attachments"] | null;
    }[]).map((m) => ({
      id: m.id,
      direction: m.direction,
      from: m.direction === "out" ? "Tu" : m.from_name || m.from_email || "Mittente sconosciuto",
      fromEmail: m.from_email,
      to: m.to_emails ?? [],
      subject: m.subject,
      receivedAt: m.received_at,
      bodyText: m.body_text,
      hasHtml: Boolean(m.body_html?.trim()),
      attachments: m.attachments ?? [],
      fromSpam: /junk|spam|indesiderata/i.test(m.mailbox),
    })),
  };
}

export async function getInboxTags(): Promise<InboxTag[]> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data } = await supabase
    .from("email_tags")
    .select("id, name, color")
    .eq("user_id", userId)
    .order("name", { ascending: true });
  return (data ?? []) as InboxTag[];
}

export type InboxSyncStatus = {
  lastSuccessAt: string | null;
  lastRunAt: string | null;
  lastError: string | null;
  /** Primo import dello storico non ancora concluso (posta in arrivo o inviati). */
  backfilling: boolean;
  /** Data dell'email più recente già importata (per mostrare l'avanzamento). */
  importedUntil: string | null;
};

export async function getInboxSyncStatus(): Promise<InboxSyncStatus> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const [{ data }, { data: latest }] = await Promise.all([
    supabase
      .from("email_sync_state")
      .select("mailbox, last_run_at, last_success_at, last_error")
      .eq("user_id", userId),
    supabase
      .from("email_messages")
      .select("received_at")
      .eq("user_id", userId)
      .eq("direction", "in")
      .not("imap_uid", "is", null)
      .order("received_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const rows = (data ?? []) as {
    mailbox: string;
    last_run_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
  }[];
  const inbox = rows.find((r) => r.mailbox === "INBOX");
  return {
    lastSuccessAt: inbox?.last_success_at ?? null,
    lastRunAt: rows.map((r) => r.last_run_at).filter(Boolean).sort().at(-1) ?? null,
    lastError: rows.map((r) => r.last_error).find(Boolean) ?? null,
    backfilling: rows.length < 2 || rows.some((r) => !r.last_success_at),
    importedUntil: (latest?.received_at as string | undefined) ?? null,
  };
}

/** Thread collegati a una collaborazione (sezione "Email" nella scheda). */
export async function getThreadsForCollaboration(collaborationId: string): Promise<InboxThreadListItem[]> {
  if (!isValidUuid(collaborationId)) return [];
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data } = await supabase
    .from("email_threads")
    .select(THREAD_SELECT)
    .eq("user_id", userId)
    .eq("collaboration_id", collaborationId)
    .order("last_message_at", { ascending: false });
  return ((data ?? []) as unknown as ThreadRowDb[]).map(mapThread);
}

/** Riepilogo per la dashboard. */
export async function getInboxDashboardSummary() {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data } = await supabase
    .from("email_threads")
    .select("status, category, is_urgent")
    .eq("user_id", userId)
    .in("status", ["nuova", "da_rispondere"]);
  const rows = (data ?? []) as { status: string; category: string | null; is_urgent: boolean }[];
  return {
    nuove: rows.filter((r) => r.status === "nuova").length,
    daRispondere: rows.filter((r) => r.status === "da_rispondere").length,
    proposte: rows.filter((r) => r.category === "proposta" || r.category === "gifting").length,
    urgenti: rows.filter((r) => r.is_urgent).length,
  };
}
