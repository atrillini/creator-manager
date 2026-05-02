"use server";

import { isValidUuid } from "@/lib/is-uuid";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

type Result = { ok: true } | { ok: false; error: string };

function toPositiveAmount(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

async function refreshPaidFlag(collaborationId: string) {
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const [collabRes, payRes] = await Promise.all([
    supabase
      .from("collaborations")
      .select("agreed_fee")
      .eq("id", collaborationId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("collaboration_payments")
      .select("amount")
      .eq("collaboration_id", collaborationId)
      .eq("user_id", userId),
  ]);
  const agreed = Number(collabRes.data?.agreed_fee ?? 0);
  const paid = (payRes.data ?? []).reduce((acc, r) => acc + Number(r.amount ?? 0), 0);
  const paidAt = agreed > 0 && paid >= agreed ? new Date().toISOString() : null;
  await supabase
    .from("collaborations")
    .update({ paid_at: paidAt })
    .eq("id", collaborationId)
    .eq("user_id", userId);
}

export async function addCollaborationPayment(input: {
  collaborationId: string;
  amount: string;
  paidAt: string;
  note?: string;
}): Promise<Result> {
  if (!isValidUuid(input.collaborationId)) {
    return { ok: false, error: "ID collaborazione non valido" };
  }
  const amount = toPositiveAmount(input.amount);
  if (!amount) {
    return { ok: false, error: "Importo pagamento non valido" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) {
    return { ok: false, error: "Data pagamento non valida" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase.from("collaboration_payments").insert({
    collaboration_id: input.collaborationId,
    user_id: userId,
    amount,
    paid_at: input.paidAt,
    note: input.note?.trim() || null,
  });
  if (error) return { ok: false, error: error.message };
  await refreshPaidFlag(input.collaborationId);
  revalidateCollaborationPaths(input.collaborationId);
  return { ok: true };
}

export async function updateCollaborationPayment(input: {
  id: string;
  collaborationId: string;
  amount: string;
  paidAt: string;
  note?: string;
}): Promise<Result> {
  if (!isValidUuid(input.id) || !isValidUuid(input.collaborationId)) {
    return { ok: false, error: "ID non valido" };
  }
  const amount = toPositiveAmount(input.amount);
  if (!amount) return { ok: false, error: "Importo pagamento non valido" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.paidAt)) {
    return { ok: false, error: "Data pagamento non valida" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase
    .from("collaboration_payments")
    .update({
      amount,
      paid_at: input.paidAt,
      note: input.note?.trim() || null,
    })
    .eq("id", input.id)
    .eq("collaboration_id", input.collaborationId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  await refreshPaidFlag(input.collaborationId);
  revalidateCollaborationPaths(input.collaborationId);
  return { ok: true };
}

export async function deleteCollaborationPayment(input: {
  id: string;
  collaborationId: string;
}): Promise<Result> {
  if (!isValidUuid(input.id) || !isValidUuid(input.collaborationId)) {
    return { ok: false, error: "ID non valido" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase
    .from("collaboration_payments")
    .delete()
    .eq("id", input.id)
    .eq("collaboration_id", input.collaborationId)
    .eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  await refreshPaidFlag(input.collaborationId);
  revalidateCollaborationPaths(input.collaborationId);
  return { ok: true };
}
