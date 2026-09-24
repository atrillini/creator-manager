import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

/** Allinea `collaborations.paid_at` alla somma dei pagamenti registrati. */
export async function refreshPaidFlag(collaborationId: string) {
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
