import type { SupabaseClient } from "@supabase/supabase-js";

export const CLOSED_COLLAB_STATUSES = ["completata", "rifiutata"];
const OPEN_THREAD_STATUSES = ["nuova", "da_rispondere", "in_attesa"];

/**
 * Collaborazione chiusa (completata/rifiutata) → le sue conversazioni aperte diventano "gestite".
 * Se poi il brand riscrive, la sync le riporta a "da rispondere".
 */
export async function closeThreadsOfCollaboration(
  supabase: SupabaseClient,
  userId: string,
  collaborationId: string,
  collaborationStatus: string
) {
  if (!CLOSED_COLLAB_STATUSES.includes(collaborationStatus)) return;
  await supabase
    .from("email_threads")
    .update({ status: "gestita", updated_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("collaboration_id", collaborationId)
    .in("status", OPEN_THREAD_STATUSES);
}
