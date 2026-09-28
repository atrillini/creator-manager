import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { classifyPendingThreads, type ClassifyResult } from "@/lib/inbox/classify";
import { syncInbox, type InboxSyncResult } from "@/lib/inbox/sync";

export type InboxJobResult = {
  sync: InboxSyncResult | null;
  syncError: string | null;
  ai: ClassifyResult | null;
  aiError: string | null;
};

/** Sync IMAP e poi analisi AI nel tempo rimanente. Usato dal cron e da "Sincronizza ora". */
export async function runInboxJob(opts: {
  supabase: SupabaseClient;
  userId: string;
  budgetMs: number;
}): Promise<InboxJobResult> {
  const start = Date.now();
  const hardDeadline = start + opts.budgetMs;
  const out: InboxJobResult = { sync: null, syncError: null, ai: null, aiError: null };
  try {
    // La sync lascia almeno un terzo del tempo all'AI.
    out.sync = await syncInbox({
      supabase: opts.supabase,
      userId: opts.userId,
      deadline: start + Math.round(opts.budgetMs * 0.66),
    });
  } catch (err) {
    out.syncError = err instanceof Error ? err.message : String(err);
  }
  try {
    out.ai = await classifyPendingThreads({
      supabase: opts.supabase,
      userId: opts.userId,
      deadline: hardDeadline - 8_000,
    });
  } catch (err) {
    out.aiError = err instanceof Error ? err.message : String(err);
  }
  return out;
}
