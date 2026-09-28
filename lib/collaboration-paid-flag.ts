import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

/**
 * Allinea `collaborations.paid_at` ai pagamenti registrati: saldata quando la somma
 * copre il compenso pattuito, con la data del pagamento che l'ha completata.
 */
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
      .select("amount, paid_at")
      .eq("collaboration_id", collaborationId)
      .eq("user_id", userId)
      .order("paid_at", { ascending: true }),
  ]);
  const agreed = Number(collabRes.data?.agreed_fee ?? 0);
  let paid = 0;
  let settledOn: string | null = null;
  for (const r of (payRes.data ?? []) as { amount: number | string; paid_at: string }[]) {
    paid += Number(r.amount ?? 0);
    if (!settledOn && agreed > 0 && paid >= agreed - 0.005) settledOn = r.paid_at;
  }
  const paidAt = settledOn ? `${settledOn}T12:00:00Z` : null;
  await supabase
    .from("collaborations")
    .update({ paid_at: paidAt })
    .eq("id", collaborationId)
    .eq("user_id", userId);
}
