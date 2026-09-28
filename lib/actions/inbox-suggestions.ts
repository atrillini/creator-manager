"use server";

import { revalidatePath } from "next/cache";
import { formatContactsSummaryLine, type BrandContact } from "@/lib/brand-contacts";
import { CLOSED_COLLAB_STATUSES } from "@/lib/inbox/collaboration-close";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

export type ApplyBrandSuggestion = {
  name: string;
  threadIds: string[];
  domains: string[];
  contact: { name: string; email: string } | null;
};

/**
 * Crea i brand confermati (o riusa quello con lo stesso nome) e associa le conversazioni.
 * Le conversazioni già associate nel frattempo non vengono toccate.
 */
export async function applyBrandSuggestions(
  items: ApplyBrandSuggestion[]
): Promise<Result<{ created: number; linked: number }>> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data: existing } = await supabase.from("brands").select("id, name, email_domains").eq("user_id", userId);
  const byName = new Map(
    ((existing ?? []) as { id: string; name: string; email_domains: string[] | null }[]).map((b) => [
      b.name.trim().toLowerCase(),
      b,
    ])
  );

  let created = 0;
  let linked = 0;
  for (const item of items) {
    const name = item.name.trim().replace(/\s+/g, " ").slice(0, 200);
    const threadIds = item.threadIds.filter(isValidUuid);
    if (!name || !threadIds.length) continue;
    const domains = item.domains.map((d) => d.trim().toLowerCase()).filter((d) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(d));

    let brand = byName.get(name.toLowerCase());
    if (brand) {
      const merged = [...new Set([...(brand.email_domains ?? []), ...domains])];
      if (merged.length !== (brand.email_domains ?? []).length) {
        await supabase.from("brands").update({ email_domains: merged }).eq("id", brand.id).eq("user_id", userId);
      }
    } else {
      const contact = item.contact?.email ? item.contact : null;
      const [firstName, ...rest] = (contact?.name ?? "").split(" ");
      const people: BrandContact[] = contact
        ? [{ firstName: firstName ?? "", lastName: rest.join(" "), email: contact.email, whatsapp: "" }]
        : [];
      const { data, error } = await supabase
        .from("brands")
        .insert({
          user_id: userId,
          name,
          contacts_json: people,
          contacts: formatContactsSummaryLine(people) || null,
          email_domains: domains,
          notes: "Creato dai suggerimenti dell'inbox",
        })
        .select("id, name, email_domains")
        .single();
      if (error) return { ok: false, error: `${name}: ${error.message}` };
      brand = data as { id: string; name: string; email_domains: string[] | null };
      byName.set(name.toLowerCase(), brand);
      created += 1;
    }

    const { data: updated, error: linkError } = await supabase
      .from("email_threads")
      .update({ brand_id: brand.id, brand_source: "manuale", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("id", threadIds)
      .is("brand_id", null)
      .select("id");
    if (linkError) return { ok: false, error: linkError.message };
    linked += updated?.length ?? 0;
  }

  revalidatePath("/inbox");
  revalidatePath("/aziende");
  revalidatePath("/collaborazioni");
  return { ok: true, created, linked };
}

/** Collega le conversazioni confermate; se il deal è già chiuso le conversazioni aperte diventano "gestite". */
export async function applyCollaborationLinks(
  links: { threadId: string; collaborationId: string }[]
): Promise<Result<{ linked: number }>> {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const byCollab = new Map<string, string[]>();
  for (const l of links) {
    if (!isValidUuid(l.threadId) || !isValidUuid(l.collaborationId)) continue;
    byCollab.set(l.collaborationId, [...(byCollab.get(l.collaborationId) ?? []), l.threadId]);
  }
  if (!byCollab.size) return { ok: false, error: "Nessun collegamento selezionato" };

  const { data: collabs } = await supabase
    .from("collaborations")
    .select("id, brand_id, status")
    .eq("user_id", userId)
    .in("id", [...byCollab.keys()]);

  let linked = 0;
  for (const c of (collabs ?? []) as { id: string; brand_id: string; status: string }[]) {
    const ids = byCollab.get(c.id) ?? [];
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("email_threads")
      .update({ collaboration_id: c.id, updated_at: now })
      .eq("user_id", userId)
      .in("id", ids)
      .is("collaboration_id", null)
      .select("id");
    if (error) return { ok: false, error: error.message };
    linked += data?.length ?? 0;
    // Il brand della collaborazione vale per le conversazioni che non ne hanno ancora uno.
    await supabase
      .from("email_threads")
      .update({ brand_id: c.brand_id, brand_source: "manuale" })
      .eq("user_id", userId)
      .in("id", ids)
      .is("brand_id", null);
    if (CLOSED_COLLAB_STATUSES.includes(c.status)) {
      await supabase
        .from("email_threads")
        .update({ status: "gestita" })
        .eq("user_id", userId)
        .in("id", ids)
        .in("status", ["nuova", "da_rispondere", "in_attesa"]);
    }
    revalidatePath(`/collaborations/${c.id}`);
  }

  revalidatePath("/inbox");
  return { ok: true, linked };
}
