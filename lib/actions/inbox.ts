"use server";

import { revalidatePath } from "next/cache";
import { isAdminUser } from "@/lib/admin";
import { classifyPendingThreads } from "@/lib/inbox/classify";
import {
  GENERIC_EMAIL_DOMAINS,
  emailDomain,
  isInboxCategory,
  isInboxStatus,
} from "@/lib/inbox/constants";
import { runInboxJob, type InboxJobResult } from "@/lib/inbox/run";
import { isValidUuid } from "@/lib/is-uuid";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

type Result = { ok: true } | { ok: false; error: string };

function revalidateInbox(collaborationIds: (string | null | undefined)[] = []) {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
  for (const id of new Set(collaborationIds)) if (id) revalidatePath(`/collaborations/${id}`);
}

export type UpdateThreadInput = {
  ids: string[];
  status?: string;
  category?: string | null;
  /** null = rimuovi associazione. */
  brandId?: string | null;
  collaborationId?: string | null;
};

/**
 * Modifica manuale di uno o più thread. Le scelte manuali non vengono più
 * sovrascritte dall'AI; associando un brand, i domini dei mittenti vengono
 * aggiunti al brand così le prossime email si associano da sole.
 */
export async function updateInboxThreads(input: UpdateThreadInput): Promise<Result> {
  const ids = input.ids.filter(isValidUuid);
  if (!ids.length) return { ok: false, error: "Nessun thread selezionato" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (input.status !== undefined) {
    if (!isInboxStatus(input.status)) return { ok: false, error: "Stato non valido" };
    patch.status = input.status;
  }
  if (input.category !== undefined) {
    if (input.category !== null && !isInboxCategory(input.category)) {
      return { ok: false, error: "Categoria non valida" };
    }
    patch.category = input.category;
    patch.category_source = input.category ? "manuale" : null;
  }
  let collabBrandId: string | null = null;
  if (input.collaborationId !== undefined) {
    if (input.collaborationId !== null) {
      if (!isValidUuid(input.collaborationId)) return { ok: false, error: "Collaborazione non valida" };
      const { data: collab } = await supabase
        .from("collaborations")
        .select("id, brand_id")
        .eq("id", input.collaborationId)
        .eq("user_id", userId)
        .maybeSingle();
      if (!collab) return { ok: false, error: "Collaborazione non trovata" };
      collabBrandId = collab.brand_id as string;
    }
    patch.collaboration_id = input.collaborationId;
  }
  const brandId = input.brandId !== undefined ? input.brandId : collabBrandId ?? undefined;
  if (brandId !== undefined) {
    if (brandId !== null && !isValidUuid(brandId)) return { ok: false, error: "Brand non valido" };
    patch.brand_id = brandId;
    patch.brand_source = brandId ? "manuale" : null;
  }

  const { data: before } = await supabase
    .from("email_threads")
    .select("id, collaboration_id, participants")
    .eq("user_id", userId)
    .in("id", ids);
  const { error } = await supabase.from("email_threads").update(patch).eq("user_id", userId).in("id", ids);
  if (error) return { ok: false, error: error.message };

  if (brandId) {
    await learnBrandDomains(
      userId,
      brandId,
      (before ?? []).flatMap((t) => (t.participants as string[] | null) ?? [])
    );
  }

  revalidateInbox([
    ...(before ?? []).map((t) => t.collaboration_id as string | null),
    typeof input.collaborationId === "string" ? input.collaborationId : null,
  ]);
  return { ok: true };
}

async function learnBrandDomains(userId: string, brandId: string, emails: string[]) {
  const domains = [
    ...new Set(
      emails.map(emailDomain).filter((d): d is string => !!d && !GENERIC_EMAIL_DOMAINS.has(d))
    ),
  ];
  if (!domains.length) return;
  const supabase = await createSupabaseClient();
  const { data: brand } = await supabase
    .from("brands")
    .select("email_domains")
    .eq("id", brandId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!brand) return;
  const current = new Set((brand.email_domains as string[] | null) ?? []);
  const next = [...new Set([...current, ...domains])];
  if (next.length === current.size) return;
  await supabase.from("brands").update({ email_domains: next }).eq("id", brandId).eq("user_id", userId);
  revalidatePath("/aziende");
}

function normalizeTagName(input: string) {
  return input.trim().replace(/\s+/g, " ").slice(0, 48);
}

export async function addInboxThreadTag(input: { threadIds: string[]; name: string }): Promise<Result> {
  const ids = input.threadIds.filter(isValidUuid);
  const name = normalizeTagName(input.name);
  if (!ids.length || !name) return { ok: false, error: "Tag vuoto" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { data: tag, error } = await supabase
    .from("email_tags")
    .upsert({ user_id: userId, name }, { onConflict: "user_id,name" })
    .select("id")
    .single();
  if (error || !tag) return { ok: false, error: error?.message ?? "Errore salvataggio tag" };
  const { error: linkError } = await supabase
    .from("email_thread_tags")
    .upsert(
      ids.map((threadId) => ({ user_id: userId, thread_id: threadId, tag_id: tag.id })),
      { onConflict: "thread_id,tag_id", ignoreDuplicates: true }
    );
  if (linkError) return { ok: false, error: linkError.message };
  revalidateInbox();
  return { ok: true };
}

export async function removeInboxThreadTag(input: { threadId: string; tagId: string }): Promise<Result> {
  if (!isValidUuid(input.threadId) || !isValidUuid(input.tagId)) return { ok: false, error: "ID non valido" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase
    .from("email_thread_tags")
    .delete()
    .eq("user_id", userId)
    .eq("thread_id", input.threadId)
    .eq("tag_id", input.tagId);
  if (error) return { ok: false, error: error.message };
  revalidateInbox();
  return { ok: true };
}

/** Nuova analisi AI (es. dopo aver aggiunto il brand in anagrafica). */
export async function reanalyzeInboxThread(threadId: string): Promise<Result> {
  if (!isValidUuid(threadId)) return { ok: false, error: "ID non valido" };
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const res = await classifyPendingThreads({
    supabase,
    userId,
    threadIds: [threadId],
    deadline: Date.now() + 45_000,
    limit: 1,
    concurrency: 1,
  });
  if (res.skipped) return { ok: false, error: res.skipped };
  if (res.failed) {
    const { data } = await supabase.from("email_threads").select("ai_error").eq("id", threadId).maybeSingle();
    return { ok: false, error: (data?.ai_error as string | null) ?? "Analisi non riuscita" };
  }
  revalidateInbox();
  return { ok: true };
}

/** "Sincronizza ora": stesso job del cron, eseguito su richiesta (solo admin). */
export async function syncInboxNow(): Promise<{ ok: true; result: InboxJobResult } | { ok: false; error: string }> {
  const userId = await requireUserId();
  if (!isAdminUser(userId)) return { ok: false, error: "Solo per l'amministratore" };
  const result = await runInboxJob({
    supabase: createSupabaseAdminClient(),
    userId,
    budgetMs: 50_000,
  });
  revalidateInbox();
  if (result.syncError) return { ok: false, error: result.syncError };
  return { ok: true, result };
}
