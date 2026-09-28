import { NextResponse } from "next/server";
import { cronUserId, isAuthorizedCron } from "@/lib/cron-auth";
import { runInboxJob } from "@/lib/inbox/run";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const maxDuration = 60;

/** Job ogni 15 minuti: email nuove + analisi AI dei thread in coda. */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ ok: false, error: "Non autorizzato" }, { status: 401 });
  }
  const result = await runInboxJob({
    supabase: createSupabaseAdminClient(),
    userId: cronUserId(),
    budgetMs: 50_000,
  });
  const ok = !result.syncError && !result.aiError;
  return NextResponse.json({ ok, ...result }, { status: ok ? 200 : 500 });
}

export const POST = GET;
