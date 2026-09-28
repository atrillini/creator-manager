import type { ThreadInsights } from "@/lib/inbox/classify";
import { GENERIC_EMAIL_DOMAINS, emailDomain } from "@/lib/inbox/constants";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

/** Brand riconosciuto dall'AI ma assente in anagrafica, con le conversazioni da associare. */
export type BrandSuggestion = {
  key: string;
  name: string;
  threadIds: string[];
  subjects: string[];
  /** Domini dei mittenti diretti (esclusi i messaggi arrivati tramite agenzia). */
  domains: string[];
  contact: { name: string; email: string } | null;
  lastMessageAt: string | null;
  viaAgency: boolean;
  /** Tutte le conversazioni del gruppo sono di qualità bassa (email di massa). */
  lowQuality: boolean;
};

export type CollaborationLinkSuggestion = {
  collaborationId: string;
  title: string;
  brandName: string;
  status: string;
  threads: {
    id: string;
    subject: string;
    lastMessageAt: string | null;
    /** ai = indicata dall'AI; brand = stesso brand e periodo vicino alla creazione del deal. */
    source: "ai" | "brand";
  }[];
};

/** Oltre questa distanza dalla creazione del deal la conversazione non viene proposta. */
const MAX_DAYS_FROM_DEAL = 120;

type ThreadRow = {
  id: string;
  subject: string;
  first_message_at: string | null;
  last_message_at: string | null;
  brand_id: string | null;
  collaboration_id: string | null;
  category: string | null;
  quality: string | null;
  is_agency: boolean;
  participants: string[] | null;
  ai_insights: ThreadInsights | null;
};

type CollabRow = {
  id: string;
  brand_id: string;
  status: string;
  brief_text: string | null;
  created_at: string;
  brands: { name: string } | { name: string }[] | null;
};

const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

export async function getInboxSuggestions(): Promise<{
  brands: BrandSuggestion[];
  links: CollaborationLinkSuggestion[];
}> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const [threadsRes, brandsRes, collabsRes] = await Promise.all([
    supabase
      .from("email_threads")
      .select(
        "id, subject, first_message_at, last_message_at, brand_id, collaboration_id, category, quality, is_agency, participants, ai_insights"
      )
      .eq("user_id", userId)
      .gt("message_count", 0)
      .neq("category", "non_pertinente")
      .order("last_message_at", { ascending: false }),
    supabase.from("brands").select("id, name").eq("user_id", userId),
    supabase
      .from("collaborations")
      .select("id, brand_id, status, brief_text, created_at, brands ( name )")
      .eq("user_id", userId),
  ]);
  const threads = (threadsRes.data ?? []) as ThreadRow[];
  const existingBrands = new Set(((brandsRes.data ?? []) as { name: string }[]).map((b) => normalizeName(b.name)));
  const collabs = (collabsRes.data ?? []) as unknown as CollabRow[];

  // --- Brand da creare -------------------------------------------------------
  const groups = new Map<string, BrandSuggestion & { names: Map<string, number> }>();
  for (const t of threads) {
    if (t.brand_id) continue;
    const raw = t.ai_insights?.brand_name?.trim();
    if (!raw) continue;
    const key = normalizeName(raw);
    if (existingBrands.has(key)) continue;
    let g = groups.get(key);
    if (!g) {
      g = {
        key,
        name: raw,
        names: new Map(),
        threadIds: [],
        subjects: [],
        domains: [],
        contact: null,
        lastMessageAt: t.last_message_at,
        viaAgency: true,
        lowQuality: true,
      };
      groups.set(key, g);
    }
    g.names.set(raw, (g.names.get(raw) ?? 0) + 1);
    g.threadIds.push(t.id);
    if (g.subjects.length < 3) g.subjects.push(t.subject);
    if (t.quality !== "bassa") g.lowQuality = false;
    if (!t.is_agency) {
      g.viaAgency = false;
      for (const email of t.participants ?? []) {
        const d = emailDomain(email);
        if (d && !GENERIC_EMAIL_DOMAINS.has(d) && !g.domains.includes(d)) g.domains.push(d);
      }
      const c = t.ai_insights;
      if (!g.contact && c?.contact_email) {
        g.contact = { name: c.contact_name?.trim() ?? "", email: c.contact_email.trim() };
      }
    }
  }
  const brands = [...groups.values()]
    .map(({ names, ...g }) => ({
      ...g,
      // La grafia più frequente (es. "Dyson" invece di "DYSON")
      name: [...names.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? g.name,
    }))
    .sort((a, b) => b.threadIds.length - a.threadIds.length || a.name.localeCompare(b.name));

  // --- Collegamenti a collaborazioni ------------------------------------------
  const collabById = new Map(collabs.map((c) => [c.id, c]));
  const collabsByBrand = new Map<string, CollabRow[]>();
  for (const c of collabs) collabsByBrand.set(c.brand_id, [...(collabsByBrand.get(c.brand_id) ?? []), c]);

  const byCollab = new Map<string, CollaborationLinkSuggestion>();
  for (const t of threads) {
    if (t.collaboration_id) continue;
    let target: CollabRow | undefined;
    let source: "ai" | "brand" = "ai";
    const aiId = t.ai_insights?.collaboration_match_id;
    if (aiId && collabById.has(aiId)) {
      target = collabById.get(aiId);
    } else if (t.brand_id) {
      const when = new Date(t.first_message_at ?? t.last_message_at ?? Date.now()).getTime();
      const candidates = (collabsByBrand.get(t.brand_id) ?? [])
        .map((c) => ({ c, days: Math.abs(new Date(c.created_at).getTime() - when) / 86_400_000 }))
        .filter((x) => x.days <= MAX_DAYS_FROM_DEAL)
        .sort((a, b) => a.days - b.days);
      target = candidates[0]?.c;
      source = "brand";
    }
    if (!target) continue;
    let s = byCollab.get(target.id);
    if (!s) {
      const brand = Array.isArray(target.brands) ? target.brands[0] : target.brands;
      s = {
        collaborationId: target.id,
        title: target.brief_text?.trim() || "Senza titolo",
        brandName: brand?.name ?? "",
        status: target.status,
        threads: [],
      };
      byCollab.set(target.id, s);
    }
    s.threads.push({ id: t.id, subject: t.subject, lastMessageAt: t.last_message_at, source });
  }
  const links = [...byCollab.values()].sort((a, b) => b.threads.length - a.threads.length);

  return { brands, links };
}
