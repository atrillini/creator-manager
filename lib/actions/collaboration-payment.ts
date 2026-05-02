"use server";

import { isValidUuid } from "@/lib/is-uuid";
import { revalidateCollaborationPaths } from "@/lib/revalidate-collab-paths";
import { createSupabaseClient, requireUserId } from "@/lib/supabase-server";

export async function setCollaborationPaid(
  collaborationId: string,
  paid: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isValidUuid(collaborationId)) {
    return { ok: false, error: "ID collaborazione non valido" };
  }
  const [supabase, userId] = await Promise.all([createSupabaseClient(), requireUserId()]);
  const { error } = await supabase
    .from("collaborations")
    .update({
      paid_at: paid ? new Date().toISOString() : null,
    })
    .eq("id", collaborationId)
    .eq("user_id", userId);

  if (error) {
    return { ok: false, error: error.message };
  }
  revalidateCollaborationPaths(collaborationId);
  return { ok: true };
}
